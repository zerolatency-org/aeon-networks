// apps/web/src/lib/agent-tabs.ts
// The tabs on an agent's page and how the address picks one. Pure.
export const TABS = [
	{ id: "overview", label: "Overview" },
	{ id: "wallet", label: "Wallet" },
	{ id: "listing", label: "Listing" },
	{ id: "policy", label: "Policy" },
	{ id: "memory", label: "Memory" },
	{ id: "activity", label: "Activity" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

const IDS: readonly string[] = TABS.map((t) => t.id);

/** `?tab=wallet` -> "wallet". Anything unknown opens the overview. */
export function tabFromParam(
	value: string | string[] | null | undefined,
): TabId {
	const first = Array.isArray(value) ? value[0] : value;
	return first && IDS.includes(first) ? (first as TabId) : "overview";
}

export function tabHref(agentId: string, tab: TabId): string {
	const base = `/agents/${agentId}`;
	return tab === "overview" ? base : `${base}?tab=${tab}`;
}
