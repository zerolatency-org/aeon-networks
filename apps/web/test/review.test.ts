// apps/web/test/review.test.ts
import { describe, expect, test } from "bun:test";

import type { ModelView } from "@/lib/models";
import { reviewRows, reviewStatus } from "@/lib/review";
import { EMPTY_DRAFT, STEPS, type WizardDraft } from "@/lib/wizard";

const models: ModelView[] = [
	{
		id: "glm-5.2",
		label: "GLM 5.2",
		toolCalling: true,
		inputPrice: null,
		outputPrice: null,
	},
];
const good: WizardDraft = {
	name: " Scout ",
	description: "",
	avatar: { kind: "preset", id: "p07" },
	model: "glm-5.2",
	persona: "You find papers.",
	policy: null,
};
const row = (d: WizardDraft, key: string) => {
	const r = reviewRows(d, models).find((x) => x.key === key);
	if (!r) throw new Error(`no row ${key}`);
	return r;
};

describe("review rows", () => {
	test("each choice shows in plain words and points back at its step", () => {
		expect(row(good, "name")).toMatchObject({
			value: "Scout",
			step: STEPS.indexOf("identity"),
		});
		expect(row(good, "description").value).toBe("None");
		expect(row(good, "face").value).toBe("Preset p07");
		expect(
			row(
				{ ...good, avatar: { kind: "dicebear", seed: "a", bg: "tide" } },
				"face",
			).value,
		).toBe("Generated face");
		expect(row(good, "model")).toMatchObject({
			value: "GLM 5.2",
			step: STEPS.indexOf("persona"),
		});
		expect(row({ ...good, model: "other" }, "model").value).toBe("other");
	});

	test("an empty draft says what is missing instead of showing blanks", () => {
		expect(row(EMPTY_DRAFT, "name").value).toBe("Not set");
		expect(row(EMPTY_DRAFT, "face").value).toBe("Not chosen");
		expect(row(EMPTY_DRAFT, "model").value).toBe("Not chosen");
		expect(row(EMPTY_DRAFT, "persona")).toMatchObject({ value: "None" });
	});

	test("the persona shows its size, and the limits show defaults or the custom sentences", () => {
		expect(row(good, "persona").value).toBe("16 characters, about 4 tokens");
		expect(row(good, "limits")).toMatchObject({
			value: "Default limits",
			details: [],
		});
		const custom = {
			...good,
			policy: {
				perJobCap: "5000000000000000",
				dailyCap: "20000000000000000",
				minJobsCompleted: 3,
				maxHireDepth: 0,
				evaluatorMode: "aeon_verifier" as const,
			},
		};
		const limits = row(custom, "limits");
		expect(limits.value).toBe("Custom limits");
		expect(limits.details[0]).toContain("0.005 0G");
	});
});

describe("ready to mint", () => {
	test("a clean draft is ready, and a broken one names the first step to fix", () => {
		expect(reviewStatus(good)).toEqual({ ready: true, fixStep: null });
		expect(reviewStatus({ ...good, name: "" })).toEqual({
			ready: false,
			fixStep: 0,
		});
		expect(reviewStatus({ ...good, model: null })).toEqual({
			ready: false,
			fixStep: 1,
		});
		const overCap = {
			perJobCap: "9",
			dailyCap: "1",
			minJobsCompleted: 0,
			maxHireDepth: 1,
			evaluatorMode: "own_agent" as const,
		};
		expect(reviewStatus({ ...good, policy: overCap })).toEqual({
			ready: false,
			fixStep: 2,
		});
	});
});
