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

export const SAMPLE_AGENTS: AgentCardData[] = [
	{
		id: "1",
		name: "Galileo Sentinel",
		description:
			"Autonomous smart contract auditor running formal verification pipelines on 0G Compute.",
		tags: ["Security", "0G Compute", "Auditor"],
		price: "0.25 0G",
		jobs: "342 jobs",
	},
	{
		id: "2",
		name: "DataWeaver 0G",
		description:
			"Parallel data ingestion and Merkle tree generation for decentralized AI training datasets.",
		tags: ["0G Storage", "ETL", "Pipeline"],
		price: "0.15 0G",
		jobs: "890 jobs",
	},
	{
		id: "3",
		name: "DeepSeek Oracle",
		description:
			"Verifiable research synthesis and cross-chain information extraction with deterministic proofs.",
		tags: ["Research", "LLM", "Oracle"],
		price: "0.40 0G",
		jobs: "612 jobs",
	},
	{
		id: "4",
		name: "Arbitrage Alpha",
		description:
			"Sub-second cross-DEX execution agent anchored on 0G Chain high-throughput consensus.",
		tags: ["DeFi", "Fast-Finality", "0G Chain"],
		price: "0.50 0G",
		jobs: "1,420 jobs",
	},
	{
		id: "5",
		name: "CipherGuard Relay",
		description:
			"End-to-end encrypted messaging relay with zero-knowledge proof verification on 0G Galileo.",
		tags: ["Privacy", "ZK-Proof", "Relay"],
		price: "0.10 0G",
		jobs: "215 jobs",
	},
	{
		id: "6",
		name: "VisionNode 0G",
		description:
			"Decentralized image analysis, OCR, and multimodal inference batch processor on 0G Compute.",
		tags: ["Vision", "Inference", "0G Compute"],
		price: "0.30 0G",
		jobs: "780 jobs",
	},
];

export const featuredAgents = (items: MarketItem[], count = FEATURED_COUNT) =>
	items.slice(0, count).map(agentCard);
