// packages/harness/src/policy.ts
// The money gate. The model can only propose a hire; this plain function decides.
// Checks run in the Backend Blueprint's order; the first that applies wins.

export type SpendingPolicy = {
	/** most one job may cost, in wei */
	perJobCap: bigint;
	/** most all of today's hires (UTC day) may cost together, in wei */
	dailyCap: bigint;
	/** the provider must have completed at least this many jobs */
	minJobsCompleted: number;
	/** a run at this depth or deeper may not hire */
	maxHireDepth: number;
};

export const DEFAULT_POLICY: SpendingPolicy = {
	perJobCap: 10n ** 16n, // 0.01 0G
	dailyCap: 5n * 10n ** 16n, // 0.05 0G
	minJobsCompleted: 0,
	maxHireDepth: 1,
};

export type HireRequest = {
	role: "chat" | "provider" | "buyer" | "evaluator";
	hireDepth: number;
	policy: SpendingPolicy;
	listing: { active: boolean; jobsCompleted: number } | null;
	price: bigint;
	/** the hiring agent wallet's balance and the gas it must keep for the hire */
	balance: bigint;
	gasReserve: bigint;
	/** sum of today's hires by this agent, in wei */
	spentToday: bigint;
};

export type HireDecision =
	| { decision: "approved" }
	| {
			decision: "user-approval";
			reason: "OVER_PER_JOB_CAP" | "OVER_DAILY_CAP" | "CHAT_NEEDS_OWNER";
	  }
	| {
			decision: "denied";
			reason:
				| "DEPTH_LIMIT"
				| "LISTING_INACTIVE"
				| "TOO_FEW_JOBS"
				| "INSUFFICIENT_FUNDS";
	  };

export function decideHire(r: HireRequest): HireDecision {
	if (r.hireDepth >= r.policy.maxHireDepth)
		return { decision: "denied", reason: "DEPTH_LIMIT" };
	if (!r.listing?.active)
		return { decision: "denied", reason: "LISTING_INACTIVE" };
	if (r.listing.jobsCompleted < r.policy.minJobsCompleted)
		return { decision: "denied", reason: "TOO_FEW_JOBS" };
	if (r.balance < r.price + r.gasReserve)
		return { decision: "denied", reason: "INSUFFICIENT_FUNDS" };
	if (r.price > r.policy.perJobCap)
		return { decision: "user-approval", reason: "OVER_PER_JOB_CAP" };
	if (r.spentToday + r.price > r.policy.dailyCap)
		return { decision: "user-approval", reason: "OVER_DAILY_CAP" };
	if (r.role === "chat")
		return { decision: "user-approval", reason: "CHAT_NEEDS_OWNER" };
	return { decision: "approved" };
}

/** Midnight UTC of the day `now` falls in: the daily cap resets here. */
export function utcDayStart(now: Date): Date {
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}
