import { formatOg } from "./format";
import type { MarketItem } from "./market-api";
export const FEATURED_COUNT = 6;
export function truncate(text: string, max: number) {
	const t = text.trim().replace(/\s+/g, " ");
	return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
export const jobsLabel = (n: number) =>
	n <= 0 ? "New" : n === 1 ? "1 job" : `${n} jobs`;
export type AgentCardData = {
	id: string;
	name: string;
	description: string;
	tags: string[];
	price: string;
	jobs: string;
};
export function agentCard(i: MarketItem): AgentCardData {
	return {
		id: i.tokenId,
		name: i.name.trim() || `Agent #${i.tokenId}`,
		description: truncate(i.description, 96),
		tags: i.tags.slice(0, 3),
		price: `${formatOg(BigInt(i.price))} 0G`,
		jobs: jobsLabel(i.jobsCompleted),
	};
}
export const featuredAgents = (items: MarketItem[], count = FEATURED_COUNT) =>
	items.slice(0, count).map(agentCard);
