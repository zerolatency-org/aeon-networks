// apps/server/test/wallet-link.test.ts
// Google/GitHub users must link a wallet before any wallet-only route.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
	bearer,
	createGoogleUser,
	getNonce,
	setupTestApp,
	siweMessage,
	siweSignIn,
} from "./helpers";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => {
	t = await setupTestApp();
});
afterAll(() => t.close());

const newWallet = () => privateKeyToAccount(generatePrivateKey());

async function link(
	token: string,
	wallet = newWallet(),
	opts: { nonce?: string; chainId?: number } = {},
) {
	const nonce = opts.nonce ?? (await getNonce(t.app));
	const message = siweMessage({
		address: wallet.address,
		nonce,
		chainId: opts.chainId,
	});
	const signature = await wallet.signMessage({ message });
	const res = await t.app.request("/api/wallet/link", {
		method: "POST",
		headers: bearer(token),
		body: JSON.stringify({ message, signature }),
	});
	return { res, wallet, message, signature };
}

describe("wallet gate and linking", () => {
	test("a Google user without a wallet gets 403 WALLET_REQUIRED on a wallet-only route", async () => {
		const g = await createGoogleUser(t.auth, "no-wallet@example.com");
		const res = await t.app.request("/api/agents", {
			headers: bearer(g.token),
		});
		expect(res.status).toBe(403);
		expect(((await res.json()) as { code: string }).code).toBe(
			"WALLET_REQUIRED",
		);
	});

	test("linking a wallet unlocks wallet-only routes", async () => {
		const g = await createGoogleUser(t.auth, "linker@example.com");
		const { res, wallet } = await link(g.token);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			address: wallet.address.toLowerCase(),
			chainId: 16602,
			alreadyLinked: false,
		});
		const agents = await t.app.request("/api/agents", {
			headers: bearer(g.token),
		});
		expect(agents.status).toBe(200);
	});

	test("after linking, signing in with that wallet reaches the same user", async () => {
		const g = await createGoogleUser(t.auth, "same-user@example.com");
		const { wallet } = await link(g.token);
		const r = await siweSignIn(t.app, wallet);
		expect(r.status).toBe(200);
		expect(r.userId).toBe(g.userId);
	});

	test("a wallet already held by another user cannot be linked", async () => {
		const owner = newWallet();
		expect((await siweSignIn(t.app, owner)).status).toBe(200);
		const g = await createGoogleUser(t.auth, "thief@example.com");
		const { res } = await link(g.token, owner);
		expect(res.status).toBe(409);
		expect(((await res.json()) as { code: string }).code).toBe("WALLET_TAKEN");
	});

	test("linking the same wallet twice is idempotent", async () => {
		const g = await createGoogleUser(t.auth, "twice@example.com");
		const w = newWallet();
		expect((await link(g.token, w)).res.status).toBe(200);
		const again = await link(g.token, w);
		expect(again.res.status).toBe(200);
		expect(
			((await again.res.json()) as { alreadyLinked: boolean }).alreadyLinked,
		).toBe(true);
	});

	test("a replayed link message is rejected", async () => {
		const g = await createGoogleUser(t.auth, "replay@example.com");
		const first = await link(g.token);
		expect(first.res.status).toBe(200);
		const replay = await t.app.request("/api/wallet/link", {
			method: "POST",
			headers: bearer(g.token),
			body: JSON.stringify({
				message: first.message,
				signature: first.signature,
			}),
		});
		expect(replay.status).toBe(401);
	});

	test("a link message for another chain is rejected", async () => {
		const g = await createGoogleUser(t.auth, "chain@example.com");
		const { res } = await link(g.token, newWallet(), { chainId: 1 });
		expect(res.status).toBe(401);
	});

	test("linking needs a session", async () => {
		const res = await t.app.request("/api/wallet/link", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ message: "x", signature: "0x00" }),
		});
		expect(res.status).toBe(401);
	});

	test("a user cannot remove their last sign-in method", async () => {
		const g = await createGoogleUser(t.auth, "last@example.com");
		const res = await t.app.request("/api/auth/unlink-account", {
			method: "POST",
			headers: bearer(g.token),
			body: JSON.stringify({ providerId: "google" }),
		});
		expect(res.status).toBe(400);
	});
});
