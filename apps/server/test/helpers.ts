// apps/server/test/helpers.ts
// Builds the full app (auth + routes) on a fresh test database.
import type { AeonServices } from "@aeon/api/context";
import { createAuth, createWalletLinker } from "@aeon/auth";
import type { PrivateKeyAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

import { createApp } from "../src/app";
import { setupTestDb } from "./db-helpers";

export const testEnv = {
	BETTER_AUTH_URL: "http://localhost:3000",
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
	CORS_ORIGIN: "http://localhost:3001",
	SIWE_DOMAIN: "localhost:3000",
	OG_CHAIN_ID: 16602,
};

export async function setupTestApp(opts: { aeon?: AeonServices | null } = {}) {
	const { db, close } = await setupTestDb();
	const auth = createAuth(testEnv, db);
	const wallets = createWalletLinker(auth, db, testEnv);
	const app = createApp({
		db,
		auth,
		wallets,
		corsOrigin: testEnv.CORS_ORIGIN,
		version: "test",
		logRequests: false,
		aeon: opts.aeon ?? null,
	});
	return { db, auth, app, close };
}

export type TestApp = Awaited<ReturnType<typeof setupTestApp>>["app"];

const json = { "content-type": "application/json" };

export async function getNonce(app: TestApp): Promise<string> {
	const res = await app.request("/api/auth/siwe/nonce", {
		method: "POST",
		headers: json,
		body: "{}",
	});
	if (res.status !== 200)
		throw new Error(`nonce failed: ${res.status} ${await res.text()}`);
	return ((await res.json()) as { nonce: string }).nonce;
}

export function siweMessage(opts: {
	address: `0x${string}`;
	nonce: string;
	domain?: string;
	chainId?: number;
	expirationTime?: Date;
}) {
	const domain = opts.domain ?? testEnv.SIWE_DOMAIN;
	return createSiweMessage({
		domain,
		address: opts.address,
		statement: "Sign in to Aeon",
		uri: `http://${domain}`,
		version: "1",
		chainId: opts.chainId ?? testEnv.OG_CHAIN_ID,
		nonce: opts.nonce,
		issuedAt: new Date(),
		expirationTime: opts.expirationTime,
	});
}

/** Signs in with a wallet through better-auth's SIWE plugin. Returns the HTTP status and session token. */
export async function siweSignIn(
	app: TestApp,
	account: PrivateKeyAccount,
	overrides: {
		domain?: string;
		chainId?: number;
		nonce?: string;
		message?: string;
	} = {},
) {
	const nonce = overrides.nonce ?? (await getNonce(app));
	const message =
		overrides.message ??
		siweMessage({ address: account.address, nonce, ...overrides });
	const signature = await account.signMessage({ message });
	const res = await app.request("/api/auth/siwe/verify", {
		method: "POST",
		headers: json,
		body: JSON.stringify({ message, signature }),
	});
	const body = (await res.json().catch(() => ({}))) as {
		token?: string;
		user?: { id: string };
	};
	return {
		status: res.status,
		token: body.token,
		userId: body.user?.id,
		message,
		signature,
	};
}

/** Creates a user who signed in with Google (no wallet) and returns a bearer token for them. */
export async function createGoogleUser(
	auth: Awaited<ReturnType<typeof setupTestApp>>["auth"],
	email = "ada@example.com",
) {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser(
		{ name: "Ada", email, emailVerified: true },
		{ method: "oauth", oauth: { providerId: "google" } },
	);
	await ctx.internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId: `google-${user.id}`,
	});
	const session = await ctx.internalAdapter.createSession(user.id);
	return { userId: user.id, token: session.token };
}

export const bearer = (token?: string) => ({
	...json,
	authorization: `Bearer ${token ?? ""}`,
});
