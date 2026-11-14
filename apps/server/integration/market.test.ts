// apps/server/integration/market.test.ts
// List -> search -> update -> delist on a real anvil chain, plus transfer hiding a listing.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AeonServices } from "@aeon/api/context";
import { aeonAgentNftAbi } from "@aeon/chain";
import { createSecretBox } from "@aeon/crypto";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { catchUp } from "../src/indexer/indexer";
import { setupTestApp, siweSignIn } from "../test/helpers";
import { call, createAgent, listingAction } from "./api-helpers";
import {
	account,
	type Chain,
	privateKeyOf,
	startChain,
	walletFor,
} from "./chain-helpers";

let chain: Chain;
let t: Awaited<ReturnType<typeof setupTestApp>>;
let alice: string; // anvil account 4
let bob: string; // anvil account 5

beforeAll(async () => {
	chain = await startChain();
	const aeon: AeonServices = {
		client: chain.client,
		deployment: chain.deployment,
		box: createSecretBox(`0x${"cd".repeat(32)}`),
		router: { baseURL: "<http://127.0.0.1:9/v1>", apiKey: "unused" },
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

type Page = { items: { tokenId: string; price: string; tags: string[] }[] };
const search = async (qs: string) =>
	(await (await t.app.request(`/api/market/agents?${qs}`)).json()) as Page;
const found = async (qs: string, tokenId: bigint) =>
	(await search(qs)).items.find((i) => i.tokenId === tokenId.toString());

describe("marketplace on anvil", () => {
	test("list, find by search, update the price, delist", async () => {
		const agent = await createAgent(t.app, chain, alice, 4, "Patent Hound");
		const listed = await listingAction(t.app, chain, alice, 4, {
			agentId: agent.id,
			action: "list",
			price: parseEther("0.01").toString(),
			tags: ["patents", "research"],
		});
		expect(listed.status).toBe(200);

		const hit = await found("q=patent%20hound", agent.tokenId);
		expect(hit?.price).toBe(parseEther("0.01").toString());
		expect(hit?.tags).toEqual(["patents", "research"]);
		expect(await found("tag=patents", agent.tokenId)).toBeDefined();

		const detail = await t.app.request(`/api/market/agents/${agent.tokenId}`);
		const body = (await detail.json()) as {
			hire: { agentPublicKey: string } | null;
		};
		expect(body.hire?.agentPublicKey).toMatch(/^0x04/);

		await listingAction(t.app, chain, alice, 4, {
			agentId: agent.id,
			action: "update",
			price: parseEther("0.02").toString(),
			tags: ["patents"],
		});
		const updated = await found("q=patent", agent.tokenId);
		expect(updated?.price).toBe(parseEther("0.02").toString());
		expect(updated?.tags).toEqual(["patents"]);

		await listingAction(t.app, chain, alice, 4, {
			agentId: agent.id,
			action: "delist",
		});
		expect(await found("q=patent", agent.tokenId)).toBeUndefined();
	});

	test("a transferred agent disappears from the market once indexed", async () => {
		const agent = await createAgent(t.app, chain, alice, 4, "Moving Day");
		await listingAction(t.app, chain, alice, 4, {
			agentId: agent.id,
			action: "list",
			price: parseEther("0.01").toString(),
		});
		expect(await found("q=moving", agent.tokenId)).toBeDefined();

		const hash = await walletFor(chain.rpcUrl, 4).writeContract({
			address: chain.deployment.nft,
			abi: aeonAgentNftAbi,
			functionName: "transferFrom",
			args: [account(4).address, account(7).address, agent.tokenId],
		});
		await chain.client.waitForTransactionReceipt({ hash });
		await catchUp({
			db: t.db,
			client: chain.client,
			deployment: chain.deployment,
			confirmations: 0,
			chunkSize: 1000,
		});
		expect(await found("q=moving", agent.tokenId)).toBeUndefined();
		const res = await t.app.request(`/api/market/agents/${agent.tokenId}`);
		expect(res.status).toBe(404);
	});

	test("confirm refuses someone else's listing; prepare refuses a price under the minimum", async () => {
		const agent = await createAgent(t.app, chain, alice, 4, "Mine");
		const { txHash } = await listingAction(t.app, chain, alice, 4, {
			agentId: agent.id,
			action: "list",
			price: parseEther("0.01").toString(),
		});
		const stolen = await call(
			t.app,
			bob,
			"POST",
			"/api/market/listings/confirm",
			{
				txHash,
			},
		);
		expect(stolen.status).toBe(403);

		const cheap = await call(
			t.app,
			alice,
			"POST",
			"/api/market/listings/prepare",
			{
				agentId: agent.id,
				action: "update",
				price: "1",
			},
		);
		expect(cheap.status).toBe(400);
		expect(cheap.body.code).toBe("PRICE_TOO_LOW");

		const notMine = await call(
			t.app,
			bob,
			"POST",
			"/api/market/listings/prepare",
			{
				agentId: agent.id,
				action: "delist",
			},
		);
		expect(notMine.status).toBe(404);
	});
});
