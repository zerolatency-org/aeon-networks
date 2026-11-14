// Links a wallet to the user who is already signed in (Google or GitHub).
// better-auth's SIWE plugin cannot do this: its /siwe/verify always looks the user up
// by wallet and ignores the current session. This uses the same nonce store and the
// same checks, then attaches the wallet to the given user.
import type { Database } from "@aeon/db";
import { walletAddress } from "@aeon/db/schema/auth";
import { eq, sql } from "drizzle-orm";
import { getAddress, verifyMessage } from "viem";
import { parseSiweMessage } from "viem/siwe";

import type { Auth, AuthConfig } from "./index";

export type WalletLinkErrorCode =
	| "SIWE_MESSAGE_INVALID"
	| "SIWE_WRONG_DOMAIN"
	| "SIWE_WRONG_CHAIN"
	| "SIWE_EXPIRED"
	| "SIWE_NONCE_INVALID"
	| "SIWE_SIGNATURE_INVALID"
	| "WALLET_TAKEN";

export class WalletLinkError extends Error {
	constructor(
		readonly code: WalletLinkErrorCode,
		readonly status: 400 | 401 | 409,
	) {
		super(code);
		this.name = "WalletLinkError";
	}
}

export type WalletLinker = {
	link(input: { userId: string; message: string; signature: string }): Promise<{
		address: `0x${string}`;
		chainId: number;
		alreadyLinked: boolean;
	}>;
};

const NONCE_PREFIX = "siwe:";

export function createWalletLinker(
	auth: Auth,
	db: Database,
	env: Pick<AuthConfig, "SIWE_DOMAIN" | "OG_CHAIN_ID">,
): WalletLinker {
	return {
		async link({ userId, message, signature }) {
			const parsed = parseSiweMessage(message);
			if (
				!parsed.address ||
				!parsed.nonce ||
				!parsed.domain ||
				parsed.chainId === undefined
			) {
				throw new WalletLinkError("SIWE_MESSAGE_INVALID", 400);
			}
			if (parsed.domain !== env.SIWE_DOMAIN)
				throw new WalletLinkError("SIWE_WRONG_DOMAIN", 401);
			if (parsed.chainId !== env.OG_CHAIN_ID)
				throw new WalletLinkError("SIWE_WRONG_CHAIN", 401);
			if (
				parsed.expirationTime &&
				parsed.expirationTime.getTime() <= Date.now()
			) {
				throw new WalletLinkError("SIWE_EXPIRED", 401);
			}

			const ctx = await auth.$context;
			const consumed = await ctx.internalAdapter.consumeVerificationValue(
				`${NONCE_PREFIX}${parsed.nonce}`,
			);
			if (!consumed) throw new WalletLinkError("SIWE_NONCE_INVALID", 401);

			const address = getAddress(parsed.address);
			const valid = await verifyMessage({
				address,
				message,
				signature: signature as `0x${string}`,
			}).catch(() => false);
			if (!valid) throw new WalletLinkError("SIWE_SIGNATURE_INVALID", 401);

			const [existing] = await db
				.select({ userId: walletAddress.userId })
				.from(walletAddress)
				.where(sql`lower(${walletAddress.address}) = ${address.toLowerCase()}`)
				.limit(1);
			if (existing && existing.userId !== userId)
				throw new WalletLinkError("WALLET_TAKEN", 409);
			if (existing)
				return { address, chainId: parsed.chainId, alreadyLinked: true };

			const owned = await db
				.select({ id: walletAddress.id })
				.from(walletAddress)
				.where(eq(walletAddress.userId, userId))
				.limit(1);

			try {
				await db.insert(walletAddress).values({
					id: crypto.randomUUID(),
					userId,
					address,
					chainId: parsed.chainId,
					isPrimary: owned.length === 0,
					createdAt: new Date(),
				});
			} catch (err) {
				if (
					String(
						(err as { cause?: { code?: string } }).cause?.code ??
							(err as { code?: string }).code,
					) === "23505"
				) {
					throw new WalletLinkError("WALLET_TAKEN", 409);
				}
				throw err;
			}

			await ctx.internalAdapter.createAccount({
				userId,
				providerId: "siwe",
				accountId: `${address}:${parsed.chainId}`,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			return { address, chainId: parsed.chainId, alreadyLinked: false };
		},
	};
}
