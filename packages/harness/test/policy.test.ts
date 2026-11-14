// packages/harness/test/policy.test.ts
// The money gate at every boundary.
import { describe, expect, test } from "bun:test";

import { decideHire, type HireRequest, utcDayStart } from "../src/index";

const base: HireRequest = {
	role: "buyer",
	hireDepth: 0,
	policy: {
		perJobCap: 100n,
		dailyCap: 300n,
		minJobsCompleted: 2,
		maxHireDepth: 2,
	},
	listing: { active: true, jobsCompleted: 2 },
	price: 100n,
	balance: 110n,
	gasReserve: 10n,
	spentToday: 200n,
};
const decide = (over: Partial<HireRequest>) => decideHire({ ...base, ...over });

describe("decideHire", () => {
	test("exactly at every limit is approved", () => {
		expect(decide({})).toEqual({ decision: "approved" });
	});

	test("hire depth: one below the limit is fine, at the limit is denied", () => {
		expect(decide({ hireDepth: 1 }).decision).toBe("approved");
		expect(decide({ hireDepth: 2 })).toEqual({
			decision: "denied",
			reason: "DEPTH_LIMIT",
		});
	});

	test("an inactive listing or one job too few is denied", () => {
		expect(decide({ listing: null })).toMatchObject({
			reason: "LISTING_INACTIVE",
		});
		expect(
			decide({ listing: { active: false, jobsCompleted: 9 } }),
		).toMatchObject({
			reason: "LISTING_INACTIVE",
		});
		expect(
			decide({ listing: { active: true, jobsCompleted: 1 } }),
		).toMatchObject({
			reason: "TOO_FEW_JOBS",
		});
	});

	test("one wei short of price plus gas is denied", () => {
		expect(decide({ balance: 109n })).toEqual({
			decision: "denied",
			reason: "INSUFFICIENT_FUNDS",
		});
	});

	test("one wei over a cap waits for the owner", () => {
		expect(decide({ price: 101n, balance: 1000n })).toEqual({
			decision: "user-approval",
			reason: "OVER_PER_JOB_CAP",
		});
		expect(decide({ spentToday: 201n })).toEqual({
			decision: "user-approval",
			reason: "OVER_DAILY_CAP",
		});
	});

	test("a chat run always asks the owner", () => {
		expect(decide({ role: "chat" })).toMatchObject({
			decision: "user-approval",
			reason: "CHAT_NEEDS_OWNER",
		});
	});

	test("the daily cap resets at midnight UTC", () => {
		expect(utcDayStart(new Date("2026-11-07T23:59:59Z")).toISOString()).toBe(
			"2026-11-07T00:00:00.000Z",
		);
		expect(utcDayStart(new Date("2026-11-08T00:00:00Z")).toISOString()).toBe(
			"2026-11-08T00:00:00.000Z",
		);
	});
});
