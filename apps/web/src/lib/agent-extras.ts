// apps/web/src/lib/agent-extras.ts
import type { AgentExtras } from "./agent-overview";

export const extrasKeys = {
	one: (id: string) => ["agents", "extras", id] as const,
};

/** No web route for job numbers yet, so this answers null and the Overview says so. */
export async function getAgentExtras(
	_agentId: string,
): Promise<AgentExtras | null> {
	return null;
}
