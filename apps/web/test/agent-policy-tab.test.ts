// apps/web/test/agent-policy-tab.test.ts
import { describe, expect, test } from "bun:test";

import type { PolicyInput } from "@/lib/agents-parse";
import { formErrors, formToPolicy, policyToForm } from "@/lib/policy-form";

const samplePolicy: PolicyInput = {
	perJobCap: "10000000000000000", // 0.01 0G
	dailyCap: "50000000000000000", // 0.05 0G
	minJobsCompleted: 5,
	maxHireDepth: 2,
	evaluatorMode: "aeon_verifier",
};

describe("Policy edit tab data transformation", () => {
	test("converts stored policy from server to form inputs", () => {
		const form = policyToForm(samplePolicy);
		expect(form).toEqual({
			perJobCap: "0.01",
			dailyCap: "0.05",
			minJobsCompleted: "5",
			maxHireDepth: 2,
			evaluatorMode: "aeon_verifier",
		});
	});

	test("converts updated form back to server policy input", () => {
		const policy = formToPolicy({
			perJobCap: "0.2",
			dailyCap: "1.0",
			minJobsCompleted: "10",
			maxHireDepth: 3,
			evaluatorMode: "own_agent",
		});
		expect(policy).toEqual({
			perJobCap: "200000000000000000",
			dailyCap: "1000000000000000000",
			minJobsCompleted: 10,
			maxHireDepth: 3,
			evaluatorMode: "own_agent",
		});
	});

	test("validates form and catches per-job cap exceeding daily cap", () => {
		const errors = formErrors({
			perJobCap: "2.0",
			dailyCap: "1.0",
			minJobsCompleted: "0",
			maxHireDepth: 1,
			evaluatorMode: "own_agent",
		});
		expect(errors.perJobCap).toBeDefined();
		expect(errors.perJobCap).toContain("daily cap");
	});
});
