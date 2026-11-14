// apps/server/src/buyer.ts
// Acts on owners' standing instructions (POST /agents/:id/tasks) while they are away.
// The buyer role can search and propose hires; every hire goes through the money gate.
import type { AeonServices } from "@aeon/api/context";
import { sealContext } from "@aeon/api/routers/agents";
import { fromUtf8 } from "@aeon/crypto/encoding";
import type { Database } from "@aeon/db";
import { agentTasks } from "@aeon/db/schema/autonomy";
import {
	buyerRole,
	CostMeter,
	createRoleAgent,
	defineTools,
	quoteInstruction,
	requireModel,
	routerErrorCode,
	routerModel,
	walletBalanceTool,
} from "@aeon/harness";
import { eq, sql } from "drizzle-orm";
import type { Hex } from "viem";

import { type HireToolEvent, loadHirer, marketTools } from "./hiring";

/** Router spend cap for one instruction run, in neuron (0.01 0G). */
const BUYER_BUDGET_NEURON = 10n ** 16n;

export type BuyerOutcome = {
	taskId: string;
	status: "done" | "failed";
	hired: string[];
	pendingApprovals: string[];
	errorCode?: string;
};

/** Runs one queued owner instruction. Returns null when there is none. */
export async function runBuyerOnce(deps: {
	db: Database;
	aeon: AeonServices;
}): Promise<BuyerOutcome | null> {
	const { db, aeon } = deps;
	const claimed = await db.execute<{ id: string }>(sql`
		update agent_tasks set status = 'running', attempts = attempts + 1,
			locked_until = now() + interval '5 minutes'
		where id = (
			select id from agent_tasks
			where status = 'queued' or (status = 'running' and locked_until < now())
			order by created_at limit 1 for update skip locked)
		returning id`);
	const id = claimed.rows[0]?.id;
	if (!id) return null;
	const [task] = await db
		.select()
		.from(agentTasks)
		.where(eq(agentTasks.id, id));
	if (!task) return null;

	const hired: string[] = [];
	const pendingApprovals: string[] = [];
	const onEvent = (e: HireToolEvent) => {
		if (e.status === "hired") hired.push(e.jobId);
		if (e.status === "pending_approval") pendingApprovals.push(e.approvalId);
	};
	try {
		const instruction = fromUtf8(
			await aeon.box.open(
				new Uint8Array(task.instructionCipher),
				`agent-task:${task.agentId}`,
			),
		);
		const hirer = await loadHirer(db, aeon, task.agentId, {
			hireDepth: 0,
			role: "buyer",
		});
		const persona = hirer.agent.personaCipher
			? fromUtf8(
					await aeon.box.open(
						new Uint8Array(hirer.agent.personaCipher),
						sealContext.persona(hirer.wallet.address),
					),
				)
			: "";
		const meter = new CostMeter(requireModel(aeon.catalog, hirer.agent.model));
		const agent = createRoleAgent({
			role: buyerRole,
			model: routerModel(aeon.router, hirer.agent.model, meter),
			tools: defineTools({
				...marketTools(db, aeon, hirer, onEvent),
				wallet_balance: walletBalanceTool(() =>
					aeon.client.getBalance({ address: hirer.wallet.address as Hex }),
				),
			}),
			ctx: {
				agentId: hirer.agent.id,
				tokenId: hirer.agent.tokenId,
				ownerUserId: hirer.agent.ownerUserId,
				role: "buyer",
				hireDepth: 0,
				budgetNeuron: BUYER_BUDGET_NEURON,
			},
			meter,
			persona,
		});
		await agent.generate({ prompt: quoteInstruction(instruction) });
		await db
			.update(agentTasks)
			.set({
				status: "done",
				outcome: { hired, pendingApprovals },
				lockedUntil: null,
				finishedAt: new Date(),
			})
			.where(eq(agentTasks.id, id));
		return { taskId: id, status: "done", hired, pendingApprovals };
	} catch (err) {
		const code =
			routerErrorCode(err) !== "UNKNOWN"
				? routerErrorCode(err)
				: (err as Error).message.slice(0, 64);
		console.error(`buyer task ${id} failed: ${code}`);
		await db
			.update(agentTasks)
			.set({
				status: "failed",
				errorCode: code,
				outcome: { hired, pendingApprovals },
				lockedUntil: null,
				finishedAt: new Date(),
			})
			.where(eq(agentTasks.id, id));
		return {
			taskId: id,
			status: "failed",
			hired,
			pendingApprovals,
			errorCode: code,
		};
	}
}
