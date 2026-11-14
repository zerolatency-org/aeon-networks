// apps/server/test/auth-siwe.test.ts
// Wallet sign-in through better-auth's SIWE plugin plus Aeon's chain pin.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
	bearer,
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

describe("SIWE sign-in", () => {
	test("a valid signature creates a session and the profile shows the wallet", async () => {
		const w = newWallet();
		const r = await siweSignIn(t.app, w);
		expect(r.status).toBe(200);
		expect(r.token).toBeString();

		const me = await t.app.request("/api/me", { headers: bearer(r.token) });
		expect(me.status).toBe(200);
		const body = (await me.json()) as {
			wallets: { address: string; chainId: number; isPrimary: boolean }[];
		};
		expect(body.wallets).toEqual([
			{ address: w.address.toLowerCase(), chainId: 16602, isPrimary: true },
		]);
	});

	test("signing in again with the same wallet returns the same user", async () => {
		const w = newWallet();
		const a = await siweSignIn(t.app, w);
		const b = await siweSignIn(t.app, w);
		expect(b.status).toBe(200);
		expect(b.userId).toBe(a.userId);
	});

	test("a replayed nonce is rejected", async () => {
		const w = newWallet();
		const first = await siweSignIn(t.app, w);
		expect(first.status).toBe(200);
		const replay = await t.app.request("/api/auth/siwe/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				message: first.message,
				signature: first.signature,
			}),
		});
		expect(replay.status).toBe(401);
	});

	test("an expired nonce is rejected", async () => {
		const w = newWallet();
		const nonce = await getNonce(t.app);
		await t.db.execute(
			sql`update verification set expires_at = now() - interval '1 minute' where identifier = ${`siwe:${nonce}`}`,
		);
		const r = await siweSignIn(t.app, w, { nonce });
		expect(r.status).toBe(401);
	});

	test("a message for another domain is rejected", async () => {
		const r = await siweSignIn(t.app, newWallet(), { domain: "evil.example" });
		expect(r.status).toBe(401);
	});

	test("a message for another chain is rejected", async () => {
		const r = await siweSignIn(t.app, newWallet(), { chainId: 1 });
		expect(r.status).toBe(401);
	});

	test("a signature from a different wallet is rejected", async () => {
		const claimed = newWallet();
		const signer = newWallet();
		const nonce = await getNonce(t.app);
		const message = siweMessage({ address: claimed.address, nonce });
		const signature = await signer.signMessage({ message });
		const res = await t.app.request("/api/auth/siwe/verify", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ message, signature }),
		});
		expect(res.status).toBe(401);
	});

	test("a protected route returns 401 without a session", async () => {
		const res = await t.app.request("/api/me");
		expect(res.status).toBe(401);
	});
});
