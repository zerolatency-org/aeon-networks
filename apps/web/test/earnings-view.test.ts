// apps/web/test/earnings-view.test.ts
import { describe, expect, test } from "bun:test";
import {
	earningsNotes,
	generateEarningsSeries,
	type SimpleJob,
} from "@/lib/earnings-view";

const mockSettledJobs: SimpleJob[] = [
	{
		jobId: "1",
		amount: "20000000000000000", // 0.02 0G
		state: "completed",
		settledAt: "2026-11-12T10:00:00.000Z",
	},
	{
		jobId: "2",
		amount: "30000000000000000", // 0.03 0G
		state: "completed",
		settledAt: "2026-11-12T14:00:00.000Z",
	},
	{
		jobId: "3",
		amount: "50000000000000000", // 0.05 0G
		state: "completed",
		settledAt: "2026-11-13T09:00:00.000Z",
	},
	{
		jobId: "4",
		amount: "10000000000000000", // 0.01 0G pending
		state: "funded",
		settledAt: null,
	},
];

describe("Earnings View Model", () => {
	test("generateEarningsSeries groups settled jobs by calendar day", () => {
		const series = generateEarningsSeries(mockSettledJobs);
		expect(series.daily.length).toBe(2);

		const day1 = series.daily.find((d) => d.date === "2026-11-12");
		expect(day1).toBeDefined();
		expect(day1?.amountWei).toBe(50000000000000000n); // 0.05 0G
		expect(day1?.jobCount).toBe(2);

		const day2 = series.daily.find((d) => d.date === "2026-11-13");
		expect(day2).toBeDefined();
		expect(day2?.amountWei).toBe(50000000000000000n); // 0.05 0G
		expect(day2?.jobCount).toBe(1);
	});

	test("generateEarningsSeries totals settled and pending amounts accurately", () => {
		const series = generateEarningsSeries(mockSettledJobs);
		expect(series.totalSettledWei).toBe(100000000000000000n); // 0.1 0G
		expect(series.totalPendingWei).toBe(10000000000000000n); // 0.01 0G
		expect(series.settledJobCount).toBe(3);
		expect(series.pendingJobCount).toBe(1);
	});

	test("generateEarningsSeries handles empty jobs list gracefully", () => {
		const series = generateEarningsSeries([]);
		expect(series.daily).toEqual([]);
		expect(series.totalSettledWei).toBe(0n);
		expect(series.totalPendingWei).toBe(0n);
		expect(series.settledJobCount).toBe(0);
	});

	test("earningsNotes describes status when there are earnings and pending funds", () => {
		const series = generateEarningsSeries(mockSettledJobs);
		const note = earningsNotes(series);
		expect(note).toContain("0.1 0G earned across 3 finished jobs");
		expect(note).toContain("0.01 0G held in active escrow");
	});

	test("earningsNotes describes clean state when no jobs have been completed", () => {
		const series = generateEarningsSeries([]);
		const note = earningsNotes(series);
		expect(note).toBe("No settled job earnings recorded yet.");
	});

	test("generateEarningsSeries orders days chronologically", () => {
		const series = generateEarningsSeries(mockSettledJobs);
		expect(series.daily[0]?.date).toBe("2026-11-12");
		expect(series.daily[1]?.date).toBe("2026-11-13");
	});
});
