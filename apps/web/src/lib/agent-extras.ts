// apps/web/src/lib/agent-extras.ts
import type { AgentExtras } from "./agent-overview";

export const extrasKeys = {
	one: (id: string, tokenId?: string) =>
		["agents", "extras", id, tokenId] as const,
};

export async function getAgentExtras(
	agentId: string,
	tokenId?: string,
): Promise<AgentExtras | null> {
	if (!tokenId) return null;
	try {
		const res = await fetch(`/api/market/agents/${tokenId}`, {
			credentials: "include",
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			totalSettled?: string;
			jobsCompleted?: number;
		};
		return {
			earningsWei:
				typeof data.totalSettled === "string" ? data.totalSettled : null,
			jobsCompleted:
				typeof data.jobsCompleted === "number" ? data.jobsCompleted : null,
		};
	} catch {
		return null;
	}
}
