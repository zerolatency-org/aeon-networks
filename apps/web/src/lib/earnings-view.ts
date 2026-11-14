// apps/web/src/lib/earnings-view.ts
import { formatOg } from "./format";

export type SimpleJob = {
	jobId: string;
	amount: string;
	state: string;
	settledAt: string | null;
};

export type DailyEarnings = {
	date: string;
	amountWei: bigint;
	formatted0G: string;
	jobCount: number;
};

export type EarningsSeries = {
	daily: DailyEarnings[];
	totalSettledWei: bigint;
	totalPendingWei: bigint;
	settledJobCount: number;
	pendingJobCount: number;
};

export function generateEarningsSeries(jobs: SimpleJob[]): EarningsSeries {
	const dayMap = new Map<string, { amountWei: bigint; jobCount: number }>();
	let totalSettledWei = 0n;
	let totalPendingWei = 0n;
	let settledJobCount = 0;
	let pendingJobCount = 0;

	for (const job of jobs) {
		const amt = BigInt(job.amount);

		if (job.state === "completed") {
			totalSettledWei += amt;
			settledJobCount++;

			const date = (job.settledAt ?? new Date().toISOString()).slice(0, 10);
			const current = dayMap.get(date) ?? { amountWei: 0n, jobCount: 0 };
			dayMap.set(date, {
				amountWei: current.amountWei + amt,
				jobCount: current.jobCount + 1,
			});
		} else if (job.state === "funded" || job.state === "submitted") {
			totalPendingWei += amt;
			pendingJobCount++;
		}
	}

	const sortedDates = [...dayMap.keys()].sort();
	const daily: DailyEarnings[] = sortedDates.map((date) => {
		const entry = dayMap.get(date)!;
		return {
			date,
			amountWei: entry.amountWei,
			formatted0G: `${formatOg(entry.amountWei)} 0G`,
			jobCount: entry.jobCount,
		};
	});

	return {
		daily,
		totalSettledWei,
		totalPendingWei,
		settledJobCount,
		pendingJobCount,
	};
}

export function earningsNotes(series: EarningsSeries): string {
	if (series.settledJobCount === 0 && series.pendingJobCount === 0) {
		return "No settled job earnings recorded yet.";
	}

	const settledPart =
		series.settledJobCount > 0
			? `${formatOg(series.totalSettledWei)} 0G earned across ${series.settledJobCount} finished job${series.settledJobCount === 1 ? "" : "s"}`
			: "No settled earnings yet";

	if (series.pendingJobCount > 0) {
		return `${settledPart} · ${formatOg(series.totalPendingWei)} 0G held in active escrow across ${series.pendingJobCount} pending job${series.pendingJobCount === 1 ? "" : "s"}.`;
	}

	return `${settledPart}.`;
}
