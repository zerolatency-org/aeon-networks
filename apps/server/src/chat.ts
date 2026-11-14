// apps/server/src/chat.ts
// POST /api/agents/:id/chat: stateless chat over SSE. The client sends the recent
// history plus the new message; nothing from the conversation is stored. Only token
// counts and cost go to usage_events.

import type { AeonServices } from "@aeon/api/context";
import { sealContext } from "@aeon/api/routers/agents";
import type { Auth } from "@aeon/auth";
import { fromUtf8 } from "@aeon/crypto/encoding";
import type { Database } from "@aeon/db";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { usageEvents } from "@aeon/db/schema/runtime";
import {
	CostMeter,
	chatRole,
	createRoleAgent,
	defineTools,
	requireModel,
	routerErrorCode,
	routerModel,
	walletBalanceTool,
} from "@aeon/harness";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Hex } from "viem";
import { z } from "zod";

/** Router spend cap for one chat turn, in neuron (0.01 0G). */
export const CHAT_BUDGET_NEURON = 10n ** 16n;

const ChatBody = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().min(1).max(8000),
			}),
		)
		.min(1)
		.max(40),
});

const problem = (c: Context, status: 400 | 401 | 404 | 503, code: string) =>
	c.json({ code, message: code }, status);

export function chatHandler(deps: {
	db: Database;
	auth: Auth;
	aeon: AeonServices | null;
}) {
	return async (c: Context) => {
		const session = await deps.auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) return problem(c, 401, "UNAUTHORIZED");
		const aeon = deps.aeon;
		if (!aeon) return problem(c, 503, "SERVICE_UNAVAILABLE");

		const id = c.req.param("id") ?? "";
		const body = ChatBody.safeParse(await c.req.json().catch(() => null));
		if (!z.string().uuid().safeParse(id).success || !body.success) {
			return problem(c, 400, "BAD_REQUEST");
		}

		const [row] = await deps.db
			.select({ agent: agents, wallet: agentWallets.address })
			.from(agents)
			.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
			.where(and(eq(agents.id, id), eq(agents.ownerUserId, session.user.id)));
		if (!row) return problem(c, 404, "NOT_FOUND");
		const { agent, wallet } = row;

		const persona = agent.personaCipher
			? fromUtf8(
					await aeon.box.open(
						new Uint8Array(agent.personaCipher),
						sealContext.persona(wallet),
					),
				)
			: "";
		const meter = new CostMeter(requireModel(aeon.catalog, agent.model));
		const chat = createRoleAgent({
			role: chatRole,
			model: routerModel(aeon.router, agent.model, meter),
			tools: defineTools({
				wallet_balance: walletBalanceTool(() =>
					aeon.client.getBalance({ address: wallet as Hex }),
				),
			}),
			ctx: {
				agentId: agent.id,
				tokenId: agent.tokenId,
				ownerUserId: session.user.id,
				role: "chat",
				hireDepth: 0,
				budgetNeuron: CHAT_BUDGET_NEURON,
			},
			meter,
			persona,
		});

		const result = await chat.stream({
			messages: body.data.messages,
			abortSignal: c.req.raw.signal,
		});

		// Record usage once the turn ends (finished, failed or cancelled). Counts only.
		Promise.resolve(result.finishReason)
			.catch((err) => console.error("chat failed", routerErrorCode(err)))
			.finally(async () => {
				await meter.settled();
				await deps.db
					.insert(usageEvents)
					.values({
						userId: session.user.id,
						agentId: agent.id,
						kind: "chat",
						model: agent.model,
						promptTokens: meter.inputTokens,
						completionTokens: meter.outputTokens,
						cost: meter.costNeuron(),
						traceId: meter.traceIds[0] ?? null,
					})
					.catch((err) =>
						console.error("usage row failed", (err as Error).name),
					);
			});

		return result.toUIMessageStreamResponse({
			onError: (err) => routerErrorCode(err),
		});
	};
}
