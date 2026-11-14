import { walletAddress } from "@aeon/db/schema/auth";
import type { RouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";

import { protectedProcedure, publicProcedure } from "../index";

export const appRouter = {
	healthCheck: publicProcedure
		.route({ method: "GET", path: "/health-check" })
		.handler(() => "OK"),

	me: protectedProcedure
		.route({ method: "GET", path: "/me" })
		.handler(async ({ context }) => {
			const wallets = await context.db
				.select({
					address: walletAddress.address,
					chainId: walletAddress.chainId,
					isPrimary: walletAddress.isPrimary,
				})
				.from(walletAddress)
				.where(eq(walletAddress.userId, context.session.user.id))
				.orderBy(asc(walletAddress.createdAt));
			const { id, name, email, image } = context.session.user;
			return {
				user: { id, name, email, image },
				wallets: wallets.map((w) => ({
					...w,
					address: w.address.toLowerCase(),
				})),
			};
		}),
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
