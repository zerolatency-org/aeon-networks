// apps/web/test/hire-form.test.ts
import { describe, expect, test } from "bun:test";
import {
	checkBrief,
	checkBudget,
	checkEvaluator,
	estimateHireCost,
	validateHireForm,
} from "@/lib/hire-form";

describe("Hire form rules and validations", () => {
	test("checkBrief requires at least 10 characters", () => {
		expect(checkBrief("").ok).toBe(false);
		expect(checkBrief("too short").ok).toBe(false);
		expect(checkBrief("This is a valid task brief for the agent.").ok).toBe(
			true,
		);
	});

	test("checkBrief rejects briefs exceeding 4000 characters", () => {
		const longBrief = "a".repeat(4001);
		expect(checkBrief(longBrief).ok).toBe(false);
		expect(checkBrief(longBrief).message).toContain("4000 characters");
	});

	test("checkBudget requires valid numeric 0G amount", () => {
		expect(checkBudget("", 1000n, 1000n).ok).toBe(false);
		expect(checkBudget("abc", 1000n, 1000n).ok).toBe(false);
		expect(checkBudget("-1", 1000n, 1000n).ok).toBe(false);
	});

	test("checkBudget rejects budget lower than agent price", () => {
		// agent price = 0.05 0G = 50000000000000000n wei
		const res = checkBudget("0.01", 1000000000000000n, 50000000000000000n);
		expect(res.ok).toBe(false);
		expect(res.message).toContain("at least 0.05 0G");
	});

	test("checkBudget accepts budget meeting or exceeding agent price", () => {
		const res = checkBudget("0.05", 1000000000000000n, 50000000000000000n);
		expect(res.ok).toBe(true);
		expect(res.wei).toBe(50000000000000000n);
	});

	test("checkBudget enforces buyer agent perJobCap if set", () => {
		const res = checkBudget(
			"0.1",
			1000000000000000n,
			50000000000000000n,
			{ perJobCapWei: 60000000000000000n, dailyCapWei: null }, // cap = 0.06 0G
		);
		expect(res.ok).toBe(false);
		expect(res.message).toContain("exceeds your per-job cap");
	});

	test("checkBudget enforces buyer agent dailyCap if exceeded", () => {
		const res = checkBudget("0.05", 1000000000000000n, 50000000000000000n, {
			perJobCapWei: 100000000000000000n,
			dailyCapWei: 100000000000000000n, // daily cap 0.1 0G
			spentTodayWei: 80000000000000000n, // already spent 0.08 0G, leaves 0.02
		});
		expect(res.ok).toBe(false);
		expect(res.message).toContain("exceeds your remaining daily spending cap");
	});

	test("checkEvaluator accepts 'verifier' with verifier address", () => {
		const res = checkEvaluator(
			"verifier",
			"0xverifier1234567890123456789012345678901234",
		);
		expect(res.ok).toBe(true);
		expect(res.address).toBe("0xverifier1234567890123456789012345678901234");
	});

	test("checkEvaluator validates custom ethereum address", () => {
		expect(checkEvaluator("custom", "").ok).toBe(false);
		expect(checkEvaluator("custom", "invalid_address").ok).toBe(false);
		expect(
			checkEvaluator("custom", "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab").ok,
		).toBe(true);
	});

	test("estimateHireCost returns wei and formatted 0G string", () => {
		const cost = estimateHireCost(50000000000000000n);
		expect(cost.amountWei).toBe(50000000000000000n);
		expect(cost.formatted0G).toBe("0.05 0G");
	});

	test("validateHireForm returns errors object for incomplete form", () => {
		const result = validateHireForm({
			brief: "short",
			budget0G: "0",
			evaluatorChoice: "custom",
			customEvaluatorAddress: "",
			minPriceWei: 1000000000000000n,
			agentPriceWei: 10000000000000000n,
		});
		expect(result.valid).toBe(false);
		expect(result.errors.brief).toBeDefined();
		expect(result.errors.budget).toBeDefined();
		expect(result.errors.evaluator).toBeDefined();
	});

	test("validateHireForm passes when all fields are valid", () => {
		const result = validateHireForm({
			brief: "Extract quarterly revenue data from the annual PDF report.",
			budget0G: "0.05",
			evaluatorChoice: "verifier",
			verifierAddress: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
			minPriceWei: 1000000000000000n,
			agentPriceWei: 10000000000000000n,
		});
		expect(result.valid).toBe(true);
		expect(Object.keys(result.errors).length).toBe(0);
	});
});
