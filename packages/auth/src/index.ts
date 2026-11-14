// One better-auth instance for Aeon: wallet (SIWE), Google and GitHub sign-in,
// bearer tokens for curl tests, and account linking between them.
import type { Database } from "@aeon/db";
import * as schema from "@aeon/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { generateRandomString } from "better-auth/crypto";
import { bearer } from "better-auth/plugins/bearer";
import { siwe } from "better-auth/plugins/siwe";
import { verifyMessage } from "viem";

export type AuthConfig = {
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	CORS_ORIGIN: string;
	SIWE_DOMAIN: string;
	OG_CHAIN_ID: number;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
};

/** True when both values of an OAuth pair are present. */
const pair = (id?: string, secret?: string) =>
	id && secret ? { clientId: id, clientSecret: secret } : undefined;

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = [],
) {
	const google = pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
	const github = pair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

	return betterAuth({
		database: drizzleAdapter(database, { provider: "pg", schema }),
		trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		emailAndPassword: { enabled: false },
		socialProviders: {
			...(google ? { google } : {}),
			...(github ? { github } : {}),
		},
		account: {
			accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
		},
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [
			bearer(),
			siwe({
				domain: env.SIWE_DOMAIN,
				anonymous: true,
				getNonce: async () => generateRandomString(32, "a-z", "A-Z", "0-9"),
				verifyMessage: async ({ message, signature, address, chainId }) => {
					if (chainId !== env.OG_CHAIN_ID) return false;
					try {
						return await verifyMessage({
							address: address as `0x${string}`,
							message,
							signature: signature as `0x${string}`,
						});
					} catch {
						return false;
					}
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

export {
	createWalletLinker,
	WalletLinkError,
	type WalletLinker,
} from "./wallet-link";
