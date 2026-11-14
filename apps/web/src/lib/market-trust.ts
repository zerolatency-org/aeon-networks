// apps/web/src/lib/market-trust.ts
import { formatOg } from "./format";

export type TrustTone = "ok" | "warn" | "neutral";

export type TrustBadge = {
	text: string;
	tone: TrustTone;
};

export function disputeRate(completed: number, disputed: number): number {
	const total = completed + disputed;
	if (total <= 0 || disputed <= 0) return 0;
	return Math.round((disputed / total) * 100);
}

export function trustBadge(completed: number, disputed: number): TrustBadge {
	if (completed === 0 && disputed === 0) {
		return { text: "New agent", tone: "neutral" };
	}
	if (disputed === 0) {
		return { text: "Clean record", tone: "ok" };
	}
	const rate = disputeRate(completed, disputed);
	if (rate <= 5) {
		return { text: `${rate}% disputes`, tone: "ok" };
	}
	return { text: `${disputed} disputes (${rate}%)`, tone: "warn" };
}

export function plainWordsHistory(completed: number, disputed: number): string {
	if (completed === 0 && disputed === 0) {
		return "No jobs finished yet";
	}
	if (disputed === 0) {
		return completed === 1
			? "1 job completed with clean record"
			: `${completed} jobs completed with clean record`;
	}
	return `${completed} completed, ${disputed} disputed`;
}

export type PolicyFitInput = {
	buyerMinJobs: number;
	buyerPerJobCapWei: bigint | null;
	agentJobsCompleted: number;
	agentPriceWei: bigint;
};

export type PolicyFitResult = {
	fits: boolean;
	reasons: string[];
};

export function checkPolicyFit(input: PolicyFitInput): PolicyFitResult {
	const reasons: string[] = [];

	if (input.agentJobsCompleted < input.buyerMinJobs) {
		reasons.push(
			`Your policy requires at least ${input.buyerMinJobs} finished jobs (agent has ${input.agentJobsCompleted}).`,
		);
	}

	if (
		input.buyerPerJobCapWei !== null &&
		input.agentPriceWei > input.buyerPerJobCapWei
	) {
		reasons.push(
			`Agent price (${formatOg(input.agentPriceWei)} 0G) exceeds your per-job cap of ${formatOg(input.buyerPerJobCapWei)} 0G.`,
		);
	}

	return {
		fits: reasons.length === 0,
		reasons,
	};
}
