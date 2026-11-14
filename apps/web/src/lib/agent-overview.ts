// apps/web/src/lib/agent-overview.ts
// What the top of an agent's page and its Overview tab show. Pure.
import type { AgentView } from "./agents-parse";
import { formatOg } from "./format";
import { type BalanceStatus, balanceStatus, STATUS_WORDS } from "./fund";

/** Numbers that come from jobs (P8 to P10). Null until those routes exist for the web app. */
export type AgentExtras = {
	earningsWei: string | null;
	jobsCompleted: number | null;
};

export type Header = {
	name: string;
	status: string;
	/** ok = running, warn = anything else */
	tone: "ok" | "warn";
	balance: string;
	funding: BalanceStatus;
};

export function headerView(agent: AgentView): Header {
	const active = agent.status === "active";
	return {
		name: agent.name.trim() || `Agent #${agent.tokenId}`,
		status: active ? "Active" : agent.status,
		tone: active ? "ok" : "warn",
		balance:
			agent.balanceWei === null
				? "--"
				: `${formatOg(BigInt(agent.balanceWei))} 0G`,
		funding: balanceStatus(agent.balanceWei),
	};
}

export type Stat = {
	key: "balance" | "earnings" | "jobs" | "model" | "minted" | "token";
	label: string;
	value: string;
	note: string | null;
};

export function overviewStats(
	agent: AgentView,
	extras: AgentExtras | null,
): Stat[] {
	const head = headerView(agent);
	const earnings = extras?.earningsWei ?? null;
	const jobs = extras?.jobsCompleted ?? null;
	return [
		{
			key: "balance",
			label: "Balance",
			value: head.balance,
			note: STATUS_WORDS[head.funding],
		},
		{
			key: "earnings",
			label: "Earnings",
			value: earnings === null ? "--" : `${formatOg(BigInt(earnings))} 0G`,
			note: earnings === null ? "Shown once your agent finishes jobs." : null,
		},
		{
			key: "jobs",
			label: "Jobs finished",
			value: jobs === null ? "--" : String(jobs),
			note: jobs === null ? "Shown once your agent finishes jobs." : null,
		},
		{ key: "model", label: "Model", value: agent.model, note: null },
		{
			key: "minted",
			label: "Minted",
			value: agent.createdAt.slice(0, 10),
			note: null,
		},
		{ key: "token", label: "Token", value: `#${agent.tokenId}`, note: null },
	];
}
