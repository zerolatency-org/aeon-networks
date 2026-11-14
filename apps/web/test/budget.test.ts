// apps/web/test/budget.test.ts
import { describe, expect, test } from "bun:test";
import {
	budgetProblems,
	gzipBytes,
	isThreeChunk,
	kb,
	LIMITS,
} from "../e2e/budget";

describe("Performance Speed Budget Rules", () => {
	test("LIMITS establishes strict ceilings for landing JS and 3D bundles", () => {
		expect(LIMITS.baseKb).toBe(170);
		expect(LIMITS.threeKb).toBe(350);
	});

	test("kb converts bytes to one-decimal kilobyte representation", () => {
		expect(kb(1024)).toBe(1);
		expect(kb(2048)).toBe(2);
		expect(kb(1536)).toBe(1.5);
	});

	test("gzipBytes measures compressed byte length", () => {
		const sample = "console.log('Aeon autonomous agents on 0G');".repeat(20);
		const compressedLength = gzipBytes(sample);
		expect(compressedLength).toBeLessThan(sample.length);
		expect(compressedLength).toBeGreaterThan(0);
	});

	test("isThreeChunk correctly identifies Three.js WebGL bundle contents", () => {
		expect(isThreeChunk("function init() { new WebGLRenderer(); }")).toBe(true);
		expect(isThreeChunk("function init() { return 42; }")).toBe(false);
	});

	test("budgetProblems returns empty list when sizes are within limits", () => {
		const okSizes = {
			baseBytes: 150 * 1024,
			threeBytes: 300 * 1024,
		};
		expect(budgetProblems(okSizes)).toEqual([]);
	});

	test("budgetProblems flags over-budget bundles with clear metrics", () => {
		const overSizes = {
			baseBytes: 180 * 1024,
			threeBytes: 380 * 1024,
		};
		const problems = budgetProblems(overSizes);
		expect(problems.length).toBe(2);
		expect(problems[0]).toContain(
			"landing JS is 180 KB gzip, over the 170 KB budget",
		);
		expect(problems[1]).toContain(
			"3D chunk is 380 KB gzip, over the 350 KB budget",
		);
	});

	test("budgetProblems handles absence of 3D bundle gracefully", () => {
		const noThreeSizes = {
			baseBytes: 120 * 1024,
			threeBytes: null,
		};
		expect(budgetProblems(noThreeSizes)).toEqual([]);
	});
});
