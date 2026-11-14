// packages/api/src/routers/approvals.ts
// The owner's inbox: unsure verdicts (P9) and over-policy hires (P10). Deciding only
// records the decision; the worker acts on it (complete/dispute, or the hire).
import { approvals } from "@aeon/db/schema/evaluation";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { walletProcedure } from "../index";

const view = (a: typeof approvals.$inferSelect) => ({
	id: a.id,
	kind: a.kind,
	status: a.status,
	agentId: a.agentId,
	tokenId: a.tokenId,
	amount: a.amount,
	reason: a.reason,
	requestedAt: a.requestedAt.toISOString(),
	decidedAt: a.decidedAt?.toISOString() ?? null,
});

export const approvalsRouter = {
	list: walletProcedure
		.route({ method: "GET", path: "/approvals" })
		.input(
			z.object({
				status: z
					.enum(["pending", "approved", "rejected", "expired", "done"])
					.default("pending"),
			}),
		)
		.handler(async ({ context, input }) => {
			const rows = await context.db
				.select()
				.from(approvals)
				.where(
					and(
						eq(approvals.userId, context.session.user.id),
						eq(approvals.status, input.status),
					),
				)
				.orderBy(desc(approvals.requestedAt))
				.limit(100);
			return { approvals: rows.map(view) };
		}),

	decide: walletProcedure
		.route({ method: "POST", path: "/approvals/{id}/decide" })
		.input(z.object({ id: z.string().uuid(), approve: z.boolean() }))
		.handler(async ({ context, input }) => {
			const [row] = await context.db
				.update(approvals)
				.set({
					status: input.approve ? "approved" : "rejected",
					decidedBy: context.session.user.id,
					decidedAt: new Date(),
				})
				.where(
					and(
						eq(approvals.id, input.id),
						eq(approvals.userId, context.session.user.id),
						eq(approvals.status, "pending"),
					),
				)
				.returning();
			// someone else's approval, or one already decided, looks the same: not found
			if (!row)
				throw new ORPCError("NOT_FOUND", {
					status: 404,
					message: "No pending approval",
				});
			return view(row);
		}),
};
