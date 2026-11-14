// apps/web/src/lib/wizard.ts
// The mint wizard as plain functions: five steps, what each one checks, and how the
// wizard moves. No React, so every rule is testable.
import type { AvatarChoice, PolicyInput } from "./agents-parse";

export const STEPS = [
	"identity",
	"persona",
	"policy",
	"review",
	"fund",
] as const;
export type StepId = (typeof STEPS)[number];

/** The same limits the server enforces on `prepare`. */
export const LIMITS = {
	name: 48,
	description: 280,
	persona: 4000,
	maxCapDepth: 3,
} as const;

export type WizardDraft = {
	name: string;
	description: string;
	avatar: AvatarChoice | null;
	model: string | null;
	persona: string;
	/** null = the owner skipped the step, so the server defaults apply */
	policy: PolicyInput | null;
};

export type WizardState = {
	/** index into STEPS */
	step: number;
	/** the furthest step the person has reached */
	reached: number;
	draft: WizardDraft;
	/** true once the mint is confirmed: the agent exists, so the first steps are read-only */
	minted: boolean;
};

export type WizardAction =
	| { type: "next" }
	| { type: "back" }
	| { type: "go"; step: number }
	| { type: "patch"; patch: Partial<WizardDraft> }
	| { type: "minted" };

export const EMPTY_DRAFT: WizardDraft = {
	name: "",
	description: "",
	avatar: null,
	model: null,
	persona: "",
	policy: null,
};

export function initialWizard(draft: WizardDraft = EMPTY_DRAFT): WizardState {
	return { step: 0, reached: 0, draft, minted: false };
}

export type StepErrors = Record<string, string>;

const DIGITS = /^\d{1,30}$/;

export function identityErrors(d: WizardDraft): StepErrors {
	const e: StepErrors = {};
	const name = d.name.trim();
	if (name.length === 0) e.name = "Give your agent a name.";
	else if (name.length > LIMITS.name)
		e.name = `Keep the name under ${LIMITS.name} characters.`;
	if (d.description.trim().length > LIMITS.description) {
		e.description = `Keep the description under ${LIMITS.description} characters.`;
	}
	if (!d.avatar) e.avatar = "Pick a face for your agent.";
	return e;
}

export function personaErrors(d: WizardDraft): StepErrors {
	const e: StepErrors = {};
	if (!d.model) e.model = "Choose a model.";
	if (d.persona.length > LIMITS.persona)
		e.persona = `Keep the persona under ${LIMITS.persona} characters.`;
	return e;
}

export function policyErrors(d: WizardDraft): StepErrors {
	const p = d.policy;
	if (!p) return {};
	const e: StepErrors = {};
	if (!DIGITS.test(p.perJobCap)) e.perJobCap = "Enter an amount.";
	if (!DIGITS.test(p.dailyCap)) e.dailyCap = "Enter an amount.";
	if (!e.perJobCap && !e.dailyCap && BigInt(p.perJobCap) > BigInt(p.dailyCap)) {
		e.perJobCap = "The per-job cap cannot be higher than the daily cap.";
	}
	if (!Number.isInteger(p.minJobsCompleted) || p.minJobsCompleted < 0)
		e.minJobsCompleted = "Use zero or more jobs.";
	if (
		!Number.isInteger(p.maxHireDepth) ||
		p.maxHireDepth < 0 ||
		p.maxHireDepth > LIMITS.maxCapDepth
	) {
		e.maxHireDepth = `Use a depth from 0 to ${LIMITS.maxCapDepth}.`;
	}
	return e;
}

/** Errors that block leaving a step. Review and fund have none of their own. */
export function stepErrors(step: number, d: WizardDraft): StepErrors {
	switch (STEPS[step]) {
		case "identity":
			return identityErrors(d);
		case "persona":
			return personaErrors(d);
		case "policy":
			return policyErrors(d);
		default:
			return {};
	}
}

/** The first step (before `upTo`) that still has errors, or -1. Review needs all of 0 to 2 clean. */
export function firstBlockedStep(d: WizardDraft, upTo: number): number {
	for (let i = 0; i < Math.min(upTo, 3); i++) {
		if (Object.keys(stepErrors(i, d)).length > 0) return i;
	}
	return -1;
}

export function canNext(s: WizardState): boolean {
	if (s.step >= STEPS.length - 1) return false;
	// After the mint the only way forward is to fund.
	if (s.minted) return false;
	return Object.keys(stepErrors(s.step, s.draft)).length === 0;
}

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
	switch (a.type) {
		case "patch":
			if (s.minted) return s;
			return { ...s, draft: { ...s.draft, ...a.patch } };
		case "next": {
			if (!canNext(s)) return s;
			const step = s.step + 1;
			return { ...s, step, reached: Math.max(s.reached, step) };
		}
		case "back":
			if (s.minted) return s;
			return { ...s, step: Math.max(0, s.step - 1) };
		case "go": {
			if (s.minted) return s;
			const target = Math.trunc(a.step);
			if (!Number.isFinite(target) || target < 0 || target > s.reached)
				return s;
			// You cannot jump ahead of a step that is still wrong.
			const blocked = firstBlockedStep(s.draft, target);
			return blocked === -1 ? { ...s, step: target } : { ...s, step: blocked };
		}
		case "minted": {
			const fund = STEPS.length - 1;
			return { ...s, minted: true, step: fund, reached: fund };
		}
	}
}

export type Counter = { used: number; left: number; over: boolean };

/** For the character counters under the text fields. */
export function charCount(value: string, max: number): Counter {
	const used = value.length;
	return { used, left: max - used, over: used > max };
}
