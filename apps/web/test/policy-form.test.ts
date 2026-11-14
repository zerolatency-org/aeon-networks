// apps/web/test/policy-form.test.ts
import { describe, expect, test } from "bun:test";

import type { PolicyInput } from "@/lib/agents-parse";
import {
	DEFAULT_FORM,
	describePolicy,
	formErrors,
	formToPolicy,
	isDefaultPolicy,
	ogText,
	POLICY_PRESETS,
	parseOg,
	policyToForm,
} from "@/lib/policy-form";

const serverDefault: PolicyInput = {
	perJobCap: (10n ** 16n).toString(),
	dailyCap: (5n * 10n ** 16n).toString(),
	minJobsCompleted: 0,
	maxHireDepth: 1,
	evaluatorMode: "own_agent",
};

describe("amounts in 0G", () => {
	test("plain decimals become wei exactly, and anything else is null", () => {
		expect(parseOg("1")).toBe(10n ** 18n);
		expect(parseOg("0.01")).toBe(10n ** 16n);
		expect(parseOg(" 2.5 ")).toBe(25n * 10n ** 17n);
		expect(parseOg("0.000000000000000001")).toBe(1n);
		for (const bad of [
			"",
			".5",
			"-1",
			"1e3",
			"1.2.3",
			"1,5",
			"0.0000000000000000001",
			"abc",
			"1_000",
		]) {
			expect(parseOg(bad), bad).toBeNull();
		}
	});

	test("wei goes back to the shortest exact text", () => {
		expect(ogText(10n ** 16n)).toBe("0.01");
		expect(ogText(10n ** 18n)).toBe("1");
		expect(ogText(1n)).toBe("0.000000000000000001");
		for (const t of ["0.05", "12.345", "7"])
			expect(ogText(parseOg(t) ?? 0n)).toBe(t);
	});
});

describe("the form and the stored policy", () => {
	test("the default form is the server default policy", () => {
		expect(formToPolicy(DEFAULT_FORM)).toEqual(serverDefault);
		expect(isDefaultPolicy(serverDefault)).toBe(true);
		expect(isDefaultPolicy({ ...serverDefault, maxHireDepth: 2 })).toBe(false);
	});

	test("a policy turns back into form text, and an unreadable amount gives no policy", () => {
		expect(policyToForm(serverDefault)).toEqual(DEFAULT_FORM);
		expect(formToPolicy({ ...DEFAULT_FORM, perJobCap: "lots" })).toBeNull();
		expect(
			formToPolicy({ ...DEFAULT_FORM, minJobsCompleted: "-1" }),
		).toBeNull();
	});

	test("every preset is valid", () => {
		for (const p of POLICY_PRESETS)
			expect(formErrors(p.form), p.id).toEqual({});
	});
});

describe("form errors", () => {
	test("unreadable text, a per-job cap above the daily cap and a bad depth each point at their field", () => {
		expect(formErrors(DEFAULT_FORM)).toEqual({});
		expect(
			formErrors({ ...DEFAULT_FORM, perJobCap: "" }).perJobCap,
		).toBeDefined();
		expect(
			formErrors({ ...DEFAULT_FORM, dailyCap: "x" }).dailyCap,
		).toBeDefined();
		expect(
			formErrors({ ...DEFAULT_FORM, minJobsCompleted: "1.5" }).minJobsCompleted,
		).toBeDefined();
		expect(
			formErrors({ ...DEFAULT_FORM, perJobCap: "0.06" }).perJobCap,
		).toContain("daily");
		expect(
			formErrors({ ...DEFAULT_FORM, maxHireDepth: 4 }).maxHireDepth,
		).toBeDefined();
	});
});

describe("describePolicy", () => {
	test("says in plain words what the limits mean", () => {
		const lines = describePolicy(serverDefault);
		expect(lines[0]).toContain("0.01 0G");
		expect(lines[1]).toContain("0.05 0G");
		expect(lines).toContain("Hires any listed agent.");
		expect(lines).toContain("Can hire agents, but they cannot hire more.");
		expect(lines).toContain("The agent checks results itself.");
		const strict = describePolicy({
			...serverDefault,
			minJobsCompleted: 3,
			maxHireDepth: 0,
			evaluatorMode: "aeon_verifier",
		});
		expect(strict).toContain("Hires only agents with 3 or more finished jobs.");
		expect(strict).toContain("Never hires other agents.");
		expect(strict).toContain("Results are checked by the Aeon Verifier.");
	});
});
