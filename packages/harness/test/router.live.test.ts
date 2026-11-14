// packages/harness/test/router.live.test.ts
// P5 done-when: a real tool call through the 0G testnet Router. Skipped unless LIVE=1.
//   LIVE=1 ROUTER_API_KEY=sk-... bun run test:live
import { describe, expect, test } from "bun:test";
import { parseEther } from "viem";

import {
	CostMeter,
	chatRole,
	createRoleAgent,
	DEFAULT_CATALOG,
	DEFAULT_MODEL,
	defineTools,
	requireModel,
	routerModel,
	walletBalanceTool,
} from "../src/index";

const live = process.env.LIVE === "1";

describe("0G testnet Router", () => {
	test.skipIf(!live)(
		"a chat agent calls wallet_balance and answers",
		async () => {
			const apiKey = process.env.ROUTER_API_KEY;
			if (!apiKey) throw new Error("set ROUTER_API_KEY (server-only sk- key)");
			const baseURL =
				process.env.ROUTER_BASE_URL ??
				"https://router-api-testnet.integratenetwork.work/v1";
			const modelId = process.env.ROUTER_MODEL ?? DEFAULT_MODEL;
			const meter = new CostMeter(requireModel(DEFAULT_CATALOG, modelId));
			const agent = createRoleAgent({
				role: chatRole,
				model: routerModel({ baseURL, apiKey }, modelId, meter),
				tools: defineTools({
					wallet_balance: walletBalanceTool(async () => parseEther("2.25")),
				}),
				ctx: {
					agentId: crypto.randomUUID(),
					tokenId: 1n,
					ownerUserId: null,
					role: "chat",
					hireDepth: 0,
					budgetNeuron: parseEther("0.1"),
				},
				meter,
			});
			const result = await agent.generate({
				prompt:
					"Call the wallet_balance tool, then tell me the balance in one sentence.",
			});
			const called = result.steps.some((s) =>
				s.toolCalls.some((c) => c.toolName === "wallet_balance"),
			);
			console.log({
				text: result.text,
				costNeuron: meter.costNeuron(),
				traces: meter.traceIds,
			});
			expect(called).toBe(true);
			expect(result.text).toContain("2.25");
			expect(meter.traceIds.length).toBeGreaterThan(0);
		},
	);
});
