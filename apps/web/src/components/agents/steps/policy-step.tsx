// apps/web/src/components/agents/steps/policy-step.tsx
"use client";

import { useState } from "react";

import type { PolicyInput } from "@/lib/agents-parse";
import {
	DEFAULT_FORM,
	describePolicy,
	formErrors,
	formToPolicy,
	POLICY_PRESETS,
	type PolicyForm,
	policyToForm,
} from "@/lib/policy-form";
import type { WizardDraft } from "@/lib/wizard";

import { card, errorText, field, hint, quiet } from "../styles";

// While an amount is unreadable the draft holds this, so the wizard's own check blocks Next.
const UNREADABLE: PolicyInput = {
	perJobCap: "",
	dailyCap: "",
	minJobsCompleted: 0,
	maxHireDepth: 1,
	evaluatorMode: "own_agent",
};

type Props = {
	draft: WizardDraft;
	patch: (p: Partial<WizardDraft>) => void;
	alwaysCustom?: boolean;
};

export function PolicyStep({ draft, patch, alwaysCustom = false }: Props) {
	const [custom, setCustom] = useState(alwaysCustom || draft.policy !== null);
	const [form, setForm] = useState<PolicyForm>(
		draft.policy ? policyToForm(draft.policy) : DEFAULT_FORM,
	);
	const errors = custom ? formErrors(form) : {};
	const defaults = formToPolicy(DEFAULT_FORM);

	function update(next: PolicyForm) {
		setForm(next);
		patch({ policy: formToPolicy(next) ?? UNREADABLE });
	}

	function toggle(on: boolean) {
		setCustom(on);
		if (on) update(form);
		else patch({ policy: null });
	}

	return (
		<div className="space-y-6">
			<div className="flex gap-3" hidden={alwaysCustom}>
				<button
					type="button"
					className={quiet}
					aria-pressed={!custom}
					onClick={() => toggle(false)}
				>
					Use the defaults
				</button>
				<button
					type="button"
					className={quiet}
					aria-pressed={custom}
					onClick={() => toggle(true)}
				>
					Set my own limits
				</button>
			</div>

			{!custom && defaults && (
				<div className={card}>
					<p className="mb-2 font-medium">Default limits</p>
					<ul className="text-fg-2 list-disc space-y-1 pl-5">
						{describePolicy(defaults).map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			)}

			{custom && (
				<div className="space-y-5">
					<div className="flex flex-wrap gap-2">
						{POLICY_PRESETS.map((p) => (
							<button
								type="button"
								key={p.id}
								className={quiet}
								title={p.hint}
								onClick={() => update(p.form)}
							>
								{p.label}
							</button>
						))}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="per-job" className="mb-1 block font-medium">
								Per-job cap (0G)
							</label>
							<input
								id="per-job"
								className={`${field} num`}
								inputMode="decimal"
								value={form.perJobCap}
								onChange={(e) => update({ ...form, perJobCap: e.target.value })}
							/>
							{errors.perJobCap && (
								<p className={errorText}>{errors.perJobCap}</p>
							)}
						</div>
						<div>
							<label htmlFor="daily" className="mb-1 block font-medium">
								Daily cap (0G)
							</label>
							<input
								id="daily"
								className={`${field} num`}
								inputMode="decimal"
								value={form.dailyCap}
								onChange={(e) => update({ ...form, dailyCap: e.target.value })}
							/>
							{errors.dailyCap && (
								<p className={errorText}>{errors.dailyCap}</p>
							)}
						</div>
						<div>
							<label htmlFor="min-jobs" className="mb-1 block font-medium">
								Minimum finished jobs of agents it hires
							</label>
							<input
								id="min-jobs"
								className={`${field} num`}
								inputMode="numeric"
								value={form.minJobsCompleted}
								onChange={(e) =>
									update({ ...form, minJobsCompleted: e.target.value })
								}
							/>
							{errors.minJobsCompleted && (
								<p className={errorText}>{errors.minJobsCompleted}</p>
							)}
						</div>
						<div>
							<label htmlFor="depth" className="mb-1 block font-medium">
								Hire depth
							</label>
							<select
								id="depth"
								className={field}
								value={form.maxHireDepth}
								onChange={(e) =>
									update({ ...form, maxHireDepth: Number(e.target.value) })
								}
							>
								{[0, 1, 2, 3].map((d) => (
									<option key={d} value={d}>
										{d}
									</option>
								))}
							</select>
							{errors.maxHireDepth && (
								<p className={errorText}>{errors.maxHireDepth}</p>
							)}
						</div>
					</div>

					<fieldset>
						<legend className="mb-2 font-medium">
							Who judges the work it buys
						</legend>
						{(
							[
								["own_agent", "My agent judges it"],
								["aeon_verifier", "The Aeon Verifier judges it"],
							] as const
						).map(([value, label]) => (
							<label
								key={value}
								className="mr-6 inline-flex items-center gap-2"
							>
								<input
									type="radio"
									name="evaluator"
									checked={form.evaluatorMode === value}
									onChange={() => update({ ...form, evaluatorMode: value })}
								/>
								{label}
							</label>
						))}
					</fieldset>
					<p className={hint}>
						These limits are what your agent may spend when it hires other
						agents.
					</p>
				</div>
			)}
		</div>
	);
}
