// apps/server/integration/api-helpers.ts
// Drives the HTTP API like a real client would: the user's own wallet (an anvil
// account) sends every transaction the API hands back.
import { expect } from "bun:test";
import type { Hex } from "viem";

import { bearer, type TestApp } from "../test/helpers";
import { type Chain, walletFor } from "./chain-helpers";

export type Tx = { to: Hex; data: Hex; value?: string };

/** Anvil account `i` sends a transaction and waits for it to be mined. */
export async function send(chain: Chain, i: number, tx: Tx): Promise<Hex> {
	const hash = await walletFor(chain.rpcUrl, i).sendTransaction({
		to: tx.to,
		data: tx.data,
		value: BigInt(tx.value ?? "0"),
	});
	const receipt = await chain.client.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`tx reverted: ${hash}`);
	return hash;
}

/** POST/PUT JSON as a signed-in user. Returns the status and parsed body. */
export async function call<T = Record<string, unknown>>(
	app: TestApp,
	token: string | undefined,
	method: string,
	path: string,
	body?: unknown,
) {
	const res = await app.request(path, {
		method,
		headers: bearer(token),
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as T };
}

/** Mints an agent through prepare -> mint -> confirm -> authorize, as anvil account `i`. */
export async function createAgent(
	app: TestApp,
	chain: Chain,
	token: string,
	i: number,
	name = "Scout",
	persona = `persona of ${name}`,
) {
	const prepared = await call<{
		draftId: string;
		agentWallet: Hex;
		mint: Tx;
	}>(app, token, "POST", "/api/agents/prepare", {
		name,
		description: `${name} does useful things`,
		model: "glm-5.2",
		persona,
	});
	expect(prepared.status).toBe(200);
	const txHash = await send(chain, i, prepared.body.mint);
	const confirmed = await call<{
		agent: { id: string; tokenId: string };
		authorize: Tx;
	}>(app, token, "POST", "/api/agents/confirm", {
		draftId: prepared.body.draftId,
		txHash,
	});
	expect(confirmed.status).toBe(200);
	await send(chain, i, confirmed.body.authorize);
	return {
		id: confirmed.body.agent.id,
		tokenId: BigInt(confirmed.body.agent.tokenId),
		wallet: prepared.body.agentWallet,
	};
}

/** Lists, updates or delists through prepare -> send -> confirm. Returns the confirm reply. */
export async function listingAction(
	app: TestApp,
	chain: Chain,
	token: string,
	i: number,
	input: {
		agentId: string;
		action: "list" | "update" | "delist";
		price?: string;
		tags?: string[];
	},
) {
	const prepared = await call<{ tx: Tx }>(
		app,
		token,
		"POST",
		"/api/market/listings/prepare",
		input,
	);
	expect(prepared.status).toBe(200);
	const txHash = await send(chain, i, prepared.body.tx);
	return {
		txHash,
		...(await call(app, token, "POST", "/api/market/listings/confirm", {
			txHash,
		})),
	};
}
