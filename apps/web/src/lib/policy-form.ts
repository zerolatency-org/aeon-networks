// apps/web/src/lib/policy-form.ts
// The policy step as plain functions. Owners type amounts in 0G; the server stores wei.
// Defaults and rules match the server's DEFAULT_POLICY and setPolicy checks.
import type { EvaluatorMode, PolicyInput } from "./agents-parse";
import { EMPTY_DRAFT, LIMITS, policyErrors, type StepErrors } from "./wizard";

const UNIT = 10n ** 18n;

/** "0.01" -> wei. Plain decimals only: no sign, no exponent, at most 18 decimals. */
export function parseOg(text: string): bigint | null {
	const t = text.trim();
	const m = /^(\d{1,12})(?:\.(\d{1,18}))?$/.exec(t);
	if (!m) return null;
	return BigInt(m[1] as string) * UNIT + BigInt((m[2] ?? "").padEnd(18, "0"));
}

/** wei -> exact decimal text with no trailing zeros ("10000000000000000" -> "0.01"). */
export function ogText(wei: bigint): string {
	const whole = wei / UNIT;
	const frac = (wei % UNIT).toString().padStart(18, "0").replace(/0+$/, "");
	return frac === "" ? whole.toString() : `${whole}.${frac}`;
}

export type PolicyForm = {
	/** 0G, as typed */
	perJobCap: string;
	dailyCap: string;
	/** as typed */
	minJobsCompleted: string;
	maxHireDepth: number;
	evaluatorMode: EvaluatorMode;
};

/** The same defaults as the server: 0.01 0G per job, 0.05 0G a day, depth 1, own agent judges. */
export const DEFAULT_FORM: PolicyForm = {
	perJobCap: "0.01",
	dailyCap: "0.05",
	minJobsCompleted: "0",
	maxHireDepth: 1,
	evaluatorMode: "own_agent",
};

export const POLICY_PRESETS: readonly {
	id: string;
	label: string;
	hint: string;
	form: PolicyForm;
}[] = [
	{
		id: "careful",
		label: "Careful",
		hint: "Small spends, only proven agents, never hires onward.",
		form: {
			perJobCap: "0.005",
			dailyCap: "0.02",
			minJobsCompleted: "3",
			maxHireDepth: 0,
			evaluatorMode: "aeon_verifier",
		},
	},
	{
		id: "balanced",
		label: "Balanced",
		hint: "The defaults.",
		form: DEFAULT_FORM,
	},
	{
		id: "open",
		label: "Open",
		hint: "Bigger spends and one extra level of hiring.",
		form: {
			perJobCap: "0.05",
			dailyCap: "0.2",
			minJobsCompleted: "0",
			maxHireDepth: 2,
			evaluatorMode: "own_agent",
		},
	},
];

/** The form as the draft stores it (wei strings), or null when an amount cannot be read. */
export function formToPolicy(f: PolicyForm): PolicyInput | null {
	const per = parseOg(f.perJobCap);
	const daily = parseOg(f.dailyCap);
	if (
		per === null ||
		daily === null ||
		!/^\d{1,6}$/.test(f.minJobsCompleted.trim())
	)
		return null;
	return {
		perJobCap: per.toString(),
		dailyCap: daily.toString(),
		minJobsCompleted: Number(f.minJobsCompleted.trim()),
		maxHireDepth: f.maxHireDepth,
		evaluatorMode: f.evaluatorMode,
	};
}

export function policyToForm(p: PolicyInput): PolicyForm {
	return {
		perJobCap: ogText(BigInt(p.perJobCap)),
		dailyCap: ogText(BigInt(p.dailyCap)),
		minJobsCompleted: String(p.minJobsCompleted),
		maxHireDepth: p.maxHireDepth,
		evaluatorMode: p.evaluatorMode,
	};
}

/** What to show under each field. Unreadable text first, then the shared rules from the wizard. */
export function formErrors(f: PolicyForm): StepErrors {
	const e: StepErrors = {};
	if (parseOg(f.perJobCap) === null)
		e.perJobCap = "Enter an amount in 0G, like 0.01.";
	if (parseOg(f.dailyCap) === null)
		e.dailyCap = "Enter an amount in 0G, like 0.05.";
	if (!/^\d{1,6}$/.test(f.minJobsCompleted.trim()))
		e.minJobsCompleted = "Use zero or more jobs.";
	if (Object.keys(e).length > 0) {
		if (
			!Number.isInteger(f.maxHireDepth) ||
			f.maxHireDepth < 0 ||
			f.maxHireDepth > LIMITS.maxCapDepth
		) {
			e.maxHireDepth = `Use a depth from 0 to ${LIMITS.maxCapDepth}.`;
		}
		return e;
	}
	const policy = formToPolicy(f);
	return policy ? policyErrors({ ...EMPTY_DRAFT, policy }) : e;
}

export function isDefaultPolicy(p: PolicyInput): boolean {
	const d = formToPolicy(DEFAULT_FORM);
	return (
		d !== null &&
		p.perJobCap === d.perJobCap &&
		p.dailyCap === d.dailyCap &&
		p.minJobsCompleted === d.minJobsCompleted &&
		p.maxHireDepth === d.maxHireDepth &&
		p.evaluatorMode === d.evaluatorMode
	);
}

/** Plain sentences for the review step. */
export function describePolicy(p: PolicyInput): string[] {
	const per = ogText(BigInt(p.perJobCap));
	const daily = ogText(BigInt(p.dailyCap));
	const depth =
		p.maxHireDepth === 0
			? "Never hires other agents."
			: p.maxHireDepth === 1
				? "Can hire agents, but they cannot hire more."
				: `Hire chains up to ${p.maxHireDepth} deep.`;
	return [
		`Asks you before spending more than ${per} 0G on one job.`,
		`Asks you before spending more than ${daily} 0G in a day.`,
		p.minJobsCompleted === 0
			? "Hires any listed agent."
			: `Hires only agents with ${p.minJobsCompleted} or more finished jobs.`,
		depth,
		p.evaluatorMode === "aeon_verifier"
			? "Results are checked by the Aeon Verifier."
			: "The agent checks results itself.",
	];
}
