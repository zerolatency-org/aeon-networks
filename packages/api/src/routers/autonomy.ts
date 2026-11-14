// packages/api/src/routers/autonomy.ts
// P10: an owner sets what their agent may spend, and leaves it instructions to act on.
import type { Database } from "@aeon/db";
import { agents } from "@aeon/db/schema/aeon";
import { agentTasks, spendingPolicies } from "@aeon/db/schema/autonomy";
import { DEFAULT_POLICY, type SpendingPolicy } from "@aeon/harness";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { aeonProcedure, walletProcedure } from "../index";

const fail = (code: string, status: number, message = code) =>
	new ORPCError(code, { status, message });
const Wei = z.string().regex(/^\d{1,30}$/);

export type AgentPolicy = SpendingPolicy & {
	evaluatorMode: "own_agent" | "aeon_verifier";
};

/** The agent's policy, or the defaults when the owner never set one. */
export async function policyOf(
	db: Database,
	agentId: string,
): Promise<AgentPolicy> {
	const [row] = await db
		.select()
		.from(spendingPolicies)
		.where(eq(spendingPolicies.agentId, agentId));
	return row
		? {
				perJobCap: row.perJobCap,
				dailyCap: row.dailyCap,
				minJobsCompleted: row.minJobsCompleted,
				maxHireDepth: row.maxHireDepth,
				evaluatorMode: row.evaluatorMode,
			}
		: { ...DEFAULT_POLICY, evaluatorMode: "own_agent" };
}

const policyView = (p: AgentPolicy) => ({
	perJobCap: p.perJobCap.toString(),
	dailyCap: p.dailyCap.toString(),
	minJobsCompleted: p.minJobsCompleted,
	maxHireDepth: p.maxHireDepth,
	evaluatorMode: p.evaluatorMode,
});

async function ownAgent(db: Database, userId: string, id: string) {
	const [agent] = await db
		.select()
		.from(agents)
		.where(and(eq(agents.id, id), eq(agents.ownerUserId, userId)));
	if (!agent) throw fail("NOT_FOUND", 404, "No such agent");
	return agent;
}

export const autonomyRouter = {
	getPolicy: walletProcedure
		.route({ method: "GET", path: "/agents/{id}/policy" })
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			await ownAgent(context.db, context.session.user.id, input.id);
			return policyView(await policyOf(context.db, input.id));
		}),

	setPolicy: walletProcedure
		.route({ method: "PUT", path: "/agents/{id}/policy" })
		.input(
			z.object({
				id: z.string().uuid(),
				perJobCap: Wei,
				dailyCap: Wei,
				minJobsCompleted: z.number().int().min(0).max(1_000_000).default(0),
				// 0 = never hires; 3 lets a hired agent hire, and that one hire once more
				maxHireDepth: z.number().int().min(0).max(3).default(1),
				evaluatorMode: z
					.enum(["own_agent", "aeon_verifier"])
					.default("own_agent"),
			}),
		)
		.handler(async ({ context, input }) => {
			await ownAgent(context.db, context.session.user.id, input.id);
			const { id, ...rest } = input;
			const values = {
				...rest,
				perJobCap: BigInt(rest.perJobCap),
				dailyCap: BigInt(rest.dailyCap),
			};
			if (values.perJobCap > values.dailyCap) {
				throw fail("BAD_POLICY", 400, "perJobCap cannot exceed dailyCap");
			}
			await context.db
				.insert(spendingPolicies)
				.values({ agentId: id, ...values })
				.onConflictDoUpdate({
					target: spendingPolicies.agentId,
					set: { ...values, updatedAt: new Date() },
				});
			return policyView(await policyOf(context.db, id));
		}),

	createTask: aeonProcedure
		.route({ method: "POST", path: "/agents/{id}/tasks" })
		.input(
			z.object({
				id: z.string().uuid(),
				instruction: z.string().trim().min(1).max(4000),
			}),
		)
		.handler(async ({ context, input }) => {
			const agent = await ownAgent(
				context.db,
				context.session.user.id,
				input.id,
			);
			const [row] = await context.db
				.insert(agentTasks)
				.values({
					agentId: agent.id,
					userId: context.session.user.id,
					instructionCipher: Buffer.from(
						await context.aeon.box.seal(
							new TextEncoder().encode(input.instruction),
							`agent-task:${agent.id}`,
						),
					),
				})
				.returning({ id: agentTasks.id, status: agentTasks.status });
			return row;
		}),

	listTasks: walletProcedure
		.route({ method: "GET", path: "/agents/{id}/tasks" })
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			await ownAgent(context.db, context.session.user.id, input.id);
			const rows = await context.db
				.select({
					id: agentTasks.id,
					status: agentTasks.status,
					errorCode: agentTasks.errorCode,
					outcome: agentTasks.outcome,
					createdAt: agentTasks.createdAt,
				})
				.from(agentTasks)
				.where(eq(agentTasks.agentId, input.id))
				.orderBy(desc(agentTasks.createdAt))
				.limit(50);
			return {
				tasks: rows.map((r) => ({
					...r,
					createdAt: r.createdAt.toISOString(),
				})),
			};
		}),
};
