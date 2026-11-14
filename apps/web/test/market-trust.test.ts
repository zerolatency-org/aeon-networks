// apps/web/test/market-trust.test.ts
import { describe, expect, test } from "bun:test";
import {
	checkPolicyFit,
	disputeRate,
	plainWordsHistory,
	trustBadge,
} from "@/lib/market-trust";

describe("Market trust metrics", () => {
	test("disputeRate returns 0 for 0 disputes and handles zero jobs cleanly", () => {
		expect(disputeRate(0, 0)).toBe(0);
		expect(disputeRate(10, 0)).toBe(0);
	});

	test("disputeRate calculates percentage of disputed over total finished", () => {
		expect(disputeRate(9, 1)).toBe(10);
		expect(disputeRate(19, 1)).toBe(5);
	});

	test("trustBadge indicates new agent when no jobs completed", () => {
		const badge = trustBadge(0, 0);
		expect(badge.text).toBe("New agent");
		expect(badge.tone).toBe("neutral");
	});

	test("trustBadge indicates clean record when jobs completed without disputes", () => {
		const badge = trustBadge(15, 0);
		expect(badge.text).toBe("Clean record");
		expect(badge.tone).toBe("ok");
	});

	test("trustBadge warns when dispute rate is notable", () => {
		const badge = trustBadge(8, 2);
		expect(badge.text).toContain("disputes");
		expect(badge.tone).toBe("warn");
	});

	test("plainWordsHistory produces natural phrasing for various job counts", () => {
		expect(plainWordsHistory(0, 0)).toBe("No jobs finished yet");
		expect(plainWordsHistory(1, 0)).toBe("1 job completed with clean record");
		expect(plainWordsHistory(25, 0)).toBe(
			"25 jobs completed with clean record",
		);
		expect(plainWordsHistory(10, 2)).toBe("10 completed, 2 disputed");
	});

	test("checkPolicyFit approves agent that satisfies buyer policy", () => {
		const fit = checkPolicyFit({
			buyerMinJobs: 5,
			buyerPerJobCapWei: 50000000000000000n, // 0.05 0G
			agentJobsCompleted: 10,
			agentPriceWei: 20000000000000000n, // 0.02 0G
		});
		expect(fit.fits).toBe(true);
		expect(fit.reasons).toHaveLength(0);
	});

	test("checkPolicyFit reports violations when agent price exceeds cap or lacks experience", () => {
		const fit = checkPolicyFit({
			buyerMinJobs: 20,
			buyerPerJobCapWei: 10000000000000000n, // 0.01 0G
			agentJobsCompleted: 5,
			agentPriceWei: 20000000000000000n, // 0.02 0G
		});
		expect(fit.fits).toBe(false);
		expect(
			fit.reasons.some((r) => r.includes("exceeds your per-job cap")),
		).toBe(true);
		expect(fit.reasons.some((r) => r.includes("requires at least"))).toBe(true);
	});
});
