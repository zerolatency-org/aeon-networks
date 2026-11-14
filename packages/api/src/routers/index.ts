import { WalletLinkError } from "@aeon/auth";
import { walletAddress } from "@aeon/db/schema/auth";
import { ORPCError, type RouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";
import { agentsRouter } from "./agents";
import { approvalsRouter } from "./approvals";
import { autonomyRouter } from "./autonomy";
import { jobsRouter } from "./jobs";
import { marketRouter } from "./market";
import { modelsRouter } from "./models";
import { vaultRouter } from "./vault";

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

	wallet: {
		link: protectedProcedure
			.route({ method: "POST", path: "/wallet/link" })
			.input(
				z.object({
					message: z.string().min(1).max(2000),
					signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
				}),
			)
			.handler(async ({ context, input }) => {
				try {
					const linked = await context.wallets.link({
						userId: context.session.user.id,
						...input,
					});
					return { ...linked, address: linked.address.toLowerCase() };
				} catch (err) {
					if (err instanceof WalletLinkError) {
						throw new ORPCError(err.code, {
							status: err.status,
							message: err.code,
						});
					}
					throw err;
				}
			}),
	},

	agents: agentsRouter,

	models: modelsRouter,

	market: marketRouter,

	jobs: jobsRouter,

	approvals: approvalsRouter,

	vault: vaultRouter,

	autonomy: autonomyRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
