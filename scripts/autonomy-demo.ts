// scripts/autonomy-demo.ts
// P10 "done when": the owner leaves one instruction and goes offline. Their agent searches,
// hires another account's agent within its spending policy, judges the work itself, and
// the escrow pays the other owner. The worker must be running.
//   OWNER_KEY=0x... bun scripts/autonomy-demo.ts
//   INSTRUCTION="..." PER_JOB_CAP_WEI=... bun scripts/autonomy-demo.ts
import type { Hex } from "viem";

import { connect, waitUntil } from "./lib";

const key = process.env.OWNER_KEY as Hex | undefined;
if (!key)
	throw new Error("set OWNER_KEY (a funded throwaway key that owns an agent)");
const INSTRUCTION =
	process.env.INSTRUCTION ??
	"Hire an agent from the market to write one sentence explaining escrow.";
const c = await connect(key);

const { agents } = await c.api<{
	agents: { id: string; name: string; balanceWei: string | null }[];
}>("/api/agents");
const boss = agents.at(-1);
if (!boss) throw new Error("mint an agent first (scripts/agent-demo.ts)");
console.log(`${boss.name} has ${boss.balanceWei ?? "?"} wei to spend`);
await c.post(
	`/api/agents/${boss.id}/policy`,
	{
		perJobCap: process.env.PER_JOB_CAP_WEI ?? "10000000000000000",
		dailyCap: process.env.DAILY_CAP_WEI ?? "50000000000000000",
		maxHireDepth: 1,
		evaluatorMode: "own_agent",
	},
	"PUT",
);
await c.post(`/api/agents/${boss.id}/tasks`, { instruction: INSTRUCTION });
console.log("instruction left; the owner is now offline");

const { tasks } = await waitUntil(
	"the agent to act",
	() =>
		c.api<{
			tasks: {
				status: string;
				errorCode: string | null;
				outcome: { hired: string[]; pendingApprovals: string[] };
			}[];
		}>(`/api/agents/${boss.id}/tasks`),
	(r) => ["done", "failed"].includes(r.tasks[0]?.status ?? ""),
	300,
);
const run = tasks[0];
if (!run || run.status === "failed")
	throw new Error(`agent failed: ${run?.errorCode}`);
if (run.outcome.pendingApprovals.length > 0) {
	console.log(
		"over policy: approve it with POST /api/approvals/:id/decide",
		run.outcome,
	);
	process.exit(0);
}
const jobId = run.outcome.hired[0];
if (!jobId)
	throw new Error("the agent hired nobody; try a clearer INSTRUCTION");
console.log(`${boss.name} hired job ${jobId}`);

const job = await waitUntil(
	"the job to settle",
	() => c.api<{ state: string; payee: string }>(`/api/jobs/${jobId}`),
	(j) => ["completed", "disputed", "refunded", "declined"].includes(j.state),
	1200,
);
const verdict = await c.api<{ verdict: string }>(`/api/jobs/${jobId}/verdict`);
console.log(
	`job ${jobId} ${job.state} (verdict ${verdict.verdict}); payee ${job.payee}`,
);
