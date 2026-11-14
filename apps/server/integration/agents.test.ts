// apps/server/integration/agents.test.ts
// prepare -> mint -> confirm -> authorize on a real anvil chain, plus every way confirm
// must refuse a transaction.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AeonServices } from "@aeon/api/context";
import { sealContext } from "@aeon/api/routers/agents";
import { aeonAgentNftAbi } from "@aeon/chain";
import { createSecretBox } from "@aeon/crypto";
import { agentWallets } from "@aeon/db/schema/aeon";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { eq } from "drizzle-orm";
import { type Hex, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { bearer, setupTestApp, siweSignIn } from "../test/helpers";
import {
	type Chain,
	deployForeignNft,
	privateKeyOf,
	startChain,
	walletFor,
} from "./chain-helpers";

const box = createSecretBox(`0x${"cd".repeat(32)}`);
let chain: Chain;
let t: Awaited<ReturnType<typeof setupTestApp>>;
let alice: string; // anvil account 4
let bob: string; // anvil account 5

beforeAll(async () => {
	chain = await startChain();
	const aeon: AeonServices = {
		client: chain.client,
		deployment: chain.deployment,
		box,
		router: { baseURL: "http://127.0.0.1:9/v1", apiKey: "unused" },
		catalog: DEFAULT_CATALOG,
	};
	t = await setupTestApp({ aeon });
	alice =
		(await siweSignIn(t.app, privateKeyToAccount(privateKeyOf(4)))).token ?? "";
	bob =
		(await siweSignIn(t.app, privateKeyToAccount(privateKeyOf(5)))).token ?? "";
});
afterAll(async () => {
	chain?.stop();
	await t?.close();
});

type Prepared = {
	draftId: string;
	agentWallet: Hex;
	mint: { to: Hex; data: Hex; value: string };
};

async function prepare(token: string, name = "Scout"): Promise<Prepared> {
	const res = await t.app.request("/api/agents/prepare", {
		method: "POST",
		headers: bearer(token),
		body: JSON.stringify({
			name,
			model: "glm-5.2",
			persona: `persona of ${name}`,
		}),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as Prepared;
}

/** Account `i` sends a transaction and waits for it to be mined. */
async function send(i: number, tx: { to: Hex; data: Hex; value?: string }) {
	const hash = await walletFor(chain.rpcUrl, i).sendTransaction({
		to: tx.to,
		data: tx.data,
		value: BigInt(tx.value ?? "0"),
	});
	await chain.client.waitForTransactionReceipt({ hash });
	return hash;
}

const confirm = (token: string, draftId: string, txHash: Hex) =>
	t.app.request("/api/agents/confirm", {
		method: "POST",
		headers: bearer(token),
		body: JSON.stringify({ draftId, txHash }),
	});

const codeOf = async (res: Response) =>
	((await res.json()) as { code: string }).code;

describe("agents on anvil", () => {
	test("prepare, mint, confirm, authorize: the agent is live and its wallet can sign jobs", async () => {
		const p = await prepare(alice);
		const txHash = await send(4, p.mint);

		const res = await confirm(alice, p.draftId, txHash);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			agent: { id: string; tokenId: string; agentWallet: string };
			authorize: { to: Hex; data: Hex };
		};
		expect(body.agent.agentWallet).toBe(p.agentWallet);
		await send(4, body.authorize);

		const authorized = await chain.client.readContract({
			address: chain.deployment.nft,
			abi: aeonAgentNftAbi,
			functionName: "isAuthorized",
			args: [BigInt(body.agent.tokenId), p.agentWallet, 2n],
		});
		expect(authorized).toBe(true);

		const list = await t.app.request("/api/agents", { headers: bearer(alice) });
		const agents = (
			(await list.json()) as { agents: { id: string; balanceWei: string }[] }
		).agents;
		expect(agents.map((a) => a.id)).toContain(body.agent.id);
		expect(agents[0]?.balanceWei).toBe("0");

		// the sealed key opens only under its own context, to the advertised address
		const [row] = await t.db
			.select()
			.from(agentWallets)
			.where(eq(agentWallets.agentId, body.agent.id));
		const key = new TextDecoder().decode(
			await box.open(
				new Uint8Array(row?.keyCipher ?? []),
				sealContext.walletKey(p.agentWallet),
			),
		) as Hex;
		expect(privateKeyToAccount(key).address.toLowerCase()).toBe(p.agentWallet);
	});

	test("confirm rejects the same mint made on another contract", async () => {
		const foreign = await deployForeignNft(chain);
		const p = await prepare(alice);
		const txHash = await send(4, { ...p.mint, to: foreign });
		const res = await confirm(alice, p.draftId, txHash);
		expect(res.status).toBe(400);
		expect(await codeOf(res)).toBe("MINT_NOT_FOUND");
	});

	test("confirm rejects someone else's mint, and the rightful owner can still confirm it", async () => {
		const mine = await prepare(alice);
		const txHash = await send(4, mine.mint);
		const theirs = await prepare(bob);
		const res = await confirm(bob, theirs.draftId, txHash);
		expect(res.status).toBe(403);
		expect(await codeOf(res)).toBe("FORBIDDEN");
		expect((await confirm(alice, mine.draftId, txHash)).status).toBe(200);
	});

	test("confirm rejects an unmined hash, a reused hash, and a mint from another draft", async () => {
		const p = await prepare(alice);
		const unknown = keccak256(toHex(crypto.randomUUID()));
		const notMined = await confirm(alice, p.draftId, unknown);
		expect(notMined.status).toBe(409);
		expect(await codeOf(notMined)).toBe("NOT_MINED");

		const txHash = await send(4, p.mint);
		expect((await confirm(alice, p.draftId, txHash)).status).toBe(200);
		const again = await confirm(alice, p.draftId, txHash);
		expect(await codeOf(again)).toBe("ALREADY_CONFIRMED");
		const other = await prepare(alice);
		const reused = await confirm(alice, other.draftId, txHash);
		expect(reused.status).toBe(409);
		expect(await codeOf(reused)).toBe("TX_ALREADY_USED");

		const a = await prepare(alice);
		const b = await prepare(alice);
		const crossed = await send(4, b.mint); // minted from draft b's persona hash
		const mismatch = await confirm(alice, a.draftId, crossed);
		expect(mismatch.status).toBe(400);
		expect(await codeOf(mismatch)).toBe("MINT_MISMATCH");
	});

	test("prepare refuses a model that is not in the catalog", async () => {
		const res = await t.app.request("/api/agents/prepare", {
			method: "POST",
			headers: bearer(alice),
			body: JSON.stringify({ name: "X", model: "gpt-unknown" }),
		});
		expect(res.status).toBe(400);
		expect(await codeOf(res)).toBe("UNKNOWN_MODEL");
	});
});
