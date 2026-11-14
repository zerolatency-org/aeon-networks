// Procedure builders. Auth levels from the Backend Blueprint:
//   publicProcedure     anyone
//   protectedProcedure  signed in (cookie or bearer token)
//   walletProcedure     signed in AND has a linked wallet (403 WALLET_REQUIRED otherwise)
import { walletAddress } from "@aeon/db/schema/auth";
import { ORPCError, os } from "@orpc/server";
import { asc, desc, eq } from "drizzle-orm";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({ context: { session: context.session } });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireWallet = o.middleware(async ({ context, next }) => {
	const userId = context.session?.user.id;
	if (!userId) throw new ORPCError("UNAUTHORIZED");
	const [primary] = await context.db
		.select({ address: walletAddress.address, chainId: walletAddress.chainId })
		.from(walletAddress)
		.where(eq(walletAddress.userId, userId))
		.orderBy(desc(walletAddress.isPrimary), asc(walletAddress.createdAt))
		.limit(1);
	if (!primary) {
		throw new ORPCError("WALLET_REQUIRED", {
			status: 403,
			message: "Link a wallet before using this route.",
		});
	}
	return next({
		context: {
			wallet: {
				address: primary.address.toLowerCase() as `0x${string}`,
				chainId: primary.chainId,
			},
		},
	});
});

export const walletProcedure = protectedProcedure.use(requireWallet);
