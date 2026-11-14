// apps/web/src/lib/agent-list.ts
// What the My agents page shows: one row per agent, newest first, and a one-line summary. Pure.
import { truncate } from "./agent-card";
import type { AgentView, AvatarChoice } from "./agents-parse";
import { avatarTint } from "./avatar";
import { cleanSeed, fromServerAvatar } from "./avatar-choice";
import { formatOg, shortAddress } from "./format";
import { type BalanceStatus, balanceStatus } from "./fund";

export type AgentRow = {
	id: string;
	href: string;
	name: string;
	description: string;
	model: string;
	face: AvatarChoice;
	/** "0.05 0G", or "--" when the chain could not be read */
	balance: string;
	funding: BalanceStatus;
	/** short form of the agent wallet, or null before it exists */
	wallet: string | null;
};

/** The saved face, or a generated one from the agent's id so it always looks the same. */
function faceOf(agent: AgentView): AvatarChoice {
	return (
		fromServerAvatar(agent.avatarKind, agent.avatarRef) ?? {
			kind: "dicebear",
			seed: cleanSeed(agent.id) ?? "agent",
			bg: avatarTint(agent.id),
		}
	);
}

export function agentRow(agent: AgentView): AgentRow {
	return {
		id: agent.id,
		href: `/agents/${agent.id}`,
		name: agent.name.trim() || `Agent #${agent.tokenId}`,
		description: truncate(agent.description, 120),
		model: agent.model,
		face: faceOf(agent),
		balance:
			agent.balanceWei === null
				? "--"
				: `${formatOg(BigInt(agent.balanceWei))} 0G`,
		funding: balanceStatus(agent.balanceWei),
		wallet: agent.agentWallet ? shortAddress(agent.agentWallet) : null,
	};
}

/** Newest first. Returns a new array. */
export function sortAgents(agents: AgentView[]): AgentView[] {
	return [...agents].sort(
		(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
	);
}

/** "3 agents. 2 need funds." An agent whose balance is unknown is not counted as needing funds. */
export function listSummary(agents: AgentView[]): string {
	if (agents.length === 0) return "No agents yet.";
	const count = `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`;
	const needy = agents.filter((a) => {
		const s = balanceStatus(a.balanceWei);
		return s === "empty" || s === "low";
	}).length;
	if (needy === 0) return `${count}.`;
	return `${count}. ${needy} ${needy === 1 ? "needs" : "need"} funds.`;
}
