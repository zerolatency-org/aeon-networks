// apps/web/test/wizard.test.ts
import { describe, expect, test } from "bun:test";

import type { PolicyInput } from "@/lib/agents-parse";
import {
	canNext,
	charCount,
	EMPTY_DRAFT,
	firstBlockedStep,
	identityErrors,
	initialWizard,
	LIMITS,
	policyErrors,
	STEPS,
	type WizardAction,
	type WizardDraft,
	wizardReducer,
} from "@/lib/wizard";

const good: WizardDraft = {
	name: "Scout",
	description: "Finds papers",
	avatar: { kind: "dicebear", seed: "scout", bg: "tide" },
	model: "glm-5.2",
	persona: "You find papers.",
	policy: null,
};

const run = (actions: WizardAction[], draft: WizardDraft = good) =>
	actions.reduce(wizardReducer, initialWizard(draft));
const policy = (over: Partial<PolicyInput> = {}): PolicyInput => ({
	perJobCap: "100",
	dailyCap: "300",
	minJobsCompleted: 0,
	maxHireDepth: 1,
	evaluatorMode: "own_agent",
	...over,
});

describe("steps and identity", () => {
	test("there are five steps in the Blueprint order", () => {
		expect(STEPS).toEqual(["identity", "persona", "policy", "review", "fund"]);
	});

	test("identity needs a name and a face and limits the lengths", () => {
		expect(Object.keys(identityErrors(EMPTY_DRAFT)).sort()).toEqual([
			"avatar",
			"name",
		]);
		expect(identityErrors(good)).toEqual({});
		expect(identityErrors({ ...good, name: "  " }).name).toBeDefined();
		expect(
			identityErrors({ ...good, name: "a".repeat(LIMITS.name + 1) }).name,
		).toContain("48");
		expect(
			identityErrors({
				...good,
				description: "a".repeat(LIMITS.description + 1),
			}).description,
		).toContain("280");
	});

	test("counters say how much is left and when it is too much", () => {
		expect(charCount("abc", 10)).toEqual({ used: 3, left: 7, over: false });
		expect(charCount("a".repeat(11), 10)).toEqual({
			used: 11,
			left: -1,
			over: true,
		});
	});
});

describe("policy step", () => {
	test("skipping the policy is fine, and valid caps pass", () => {
		expect(policyErrors({ ...good, policy: null })).toEqual({});
		expect(policyErrors({ ...good, policy: policy() })).toEqual({});
		expect(
			policyErrors({ ...good, policy: policy({ perJobCap: "300" }) }),
		).toEqual({});
	});

	test("a per-job cap above the daily cap, a missing amount or a bad depth is an error", () => {
		expect(
			policyErrors({ ...good, policy: policy({ perJobCap: "301" }) }).perJobCap,
		).toContain("daily");
		expect(
			policyErrors({ ...good, policy: policy({ dailyCap: "" }) }).dailyCap,
		).toBeDefined();
		expect(
			policyErrors({ ...good, policy: policy({ maxHireDepth: 4 }) })
				.maxHireDepth,
		).toBeDefined();
		expect(
			policyErrors({ ...good, policy: policy({ minJobsCompleted: -1 }) })
				.minJobsCompleted,
		).toBeDefined();
	});
});

describe("moving through the wizard", () => {
	test("next is blocked until the step is valid, then moves one step", () => {
		expect(canNext(initialWizard())).toBe(false);
		expect(run([{ type: "next" }], EMPTY_DRAFT).step).toBe(0);
		expect(run([{ type: "next" }]).step).toBe(1);
		expect(
			run([{ type: "next" }, { type: "next" }, { type: "next" }]).step,
		).toBe(3);
	});

	test("fund is reached only through the mint, never with next", () => {
		const atReview = run([
			{ type: "next" },
			{ type: "next" },
			{ type: "next" },
		]);
		expect(canNext(atReview)).toBe(true);
		expect(canNext({ ...atReview, step: 4 })).toBe(false);
	});

	test("back stops at the first step, and go only reaches steps already visited", () => {
		const s = run([{ type: "next" }, { type: "next" }]);
		expect(wizardReducer(s, { type: "back" }).step).toBe(1);
		expect(run([{ type: "back" }]).step).toBe(0);
		expect(wizardReducer(s, { type: "go", step: 0 }).step).toBe(0);
		expect(wizardReducer(s, { type: "go", step: 4 }).step).toBe(2);
		expect(wizardReducer(s, { type: "go", step: Number.NaN }).step).toBe(2);
	});

	test("jumping forward lands on the first step that is still wrong", () => {
		let s = run([{ type: "next" }, { type: "next" }, { type: "next" }]);
		s = wizardReducer(s, { type: "patch", patch: { name: "" } });
		expect(firstBlockedStep(s.draft, 3)).toBe(0);
		expect(wizardReducer(s, { type: "go", step: 3 }).step).toBe(0);
	});

	test("patching changes the draft", () => {
		const s = wizardReducer(initialWizard(), {
			type: "patch",
			patch: { name: "Ada" },
		});
		expect(s.draft.name).toBe("Ada");
	});

	test("after the mint the wizard shows the fund step and the earlier steps are locked", () => {
		const s = run([
			{ type: "next" },
			{ type: "next" },
			{ type: "next" },
			{ type: "minted" },
		]);
		expect(s.step).toBe(4);
		expect(s.minted).toBe(true);
		expect(wizardReducer(s, { type: "back" })).toBe(s);
		expect(wizardReducer(s, { type: "go", step: 0 })).toBe(s);
		expect(
			wizardReducer(s, { type: "patch", patch: { name: "Changed" } }),
		).toBe(s);
	});
});
