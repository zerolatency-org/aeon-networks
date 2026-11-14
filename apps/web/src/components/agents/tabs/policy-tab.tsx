// apps/web/src/components/agents/tabs/policy-tab.tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { agentKeys, getPolicy, setPolicy } from "@/lib/agents-api";
import type { AgentView } from "@/lib/agents-parse";
import {
	DEFAULT_FORM,
	formErrors,
	formToPolicy,
	POLICY_PRESETS,
	type PolicyForm,
	policyToForm,
} from "@/lib/policy-form";

import { card, errorText, field, hint, primary, quiet } from "../styles";

export function PolicyTab({ agent }: { agent: AgentView }) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: agentKeys.policy(agent.id),
		queryFn: () => getPolicy(agent.id),
	});

	const [form, setForm] = useState<PolicyForm>(DEFAULT_FORM);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	useEffect(() => {
		if (query.data) {
			setForm(policyToForm(query.data));
		}
	}, [query.data]);

	const errors = formErrors(form);
	const hasErrors = Object.keys(errors).length > 0;

	const mutation = useMutation({
		mutationFn: async () => {
			const policy = formToPolicy(form);
			if (!policy) throw new Error("Invalid policy limits.");
			return setPolicy(agent.id, policy);
		},
		onSuccess: (updated) => {
			queryClient.setQueryData(agentKeys.policy(agent.id), updated);
			setStatusMessage("Spending limits saved successfully.");
			setTimeout(() => setStatusMessage(null), 4000);
		},
		onError: (err) => {
			setStatusMessage(
				err instanceof Error
					? err.message
					: "Failed to update spending limits.",
			);
		},
	});

	if (query.isPending) {
		return (
			<div
				className={`${card} animate-surface-pulse bg-surface-2 h-48`}
				aria-busy="true"
			/>
		);
	}

	return (
		<div className="space-y-6">
			<div className={card}>
				<h2 className="font-serif text-2xl">Spending limits & policy</h2>
				<p className={`${hint} mt-1`}>
					Define what this agent may spend when it delegates and hires other
					agents to help with tasks.
				</p>

				<div className="mt-5 flex flex-wrap gap-2">
					{POLICY_PRESETS.map((p) => (
						<button
							type="button"
							key={p.id}
							className={quiet}
							title={p.hint}
							onClick={() => setForm(p.form)}
						>
							{p.label}
						</button>
					))}
				</div>

				<form
					className="mt-6 space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (!hasErrors) mutation.mutate();
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="per-job-edit" className="mb-1 block font-medium">
								Per-job cap (0G)
							</label>
							<input
								id="per-job-edit"
								className={`${field} num`}
								inputMode="decimal"
								value={form.perJobCap}
								onChange={(e) =>
									setForm({ ...form, perJobCap: e.target.value })
								}
							/>
							{errors.perJobCap && (
								<p className={errorText}>{errors.perJobCap}</p>
							)}
						</div>

						<div>
							<label
								htmlFor="daily-cap-edit"
								className="mb-1 block font-medium"
							>
								Daily cap (0G)
							</label>
							<input
								id="daily-cap-edit"
								className={`${field} num`}
								inputMode="decimal"
								value={form.dailyCap}
								onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
							/>
							{errors.dailyCap && (
								<p className={errorText}>{errors.dailyCap}</p>
							)}
						</div>

						<div>
							<label htmlFor="min-jobs-edit" className="mb-1 block font-medium">
								Minimum finished jobs of hired agents
							</label>
							<input
								id="min-jobs-edit"
								className={`${field} num`}
								inputMode="numeric"
								value={form.minJobsCompleted}
								onChange={(e) =>
									setForm({ ...form, minJobsCompleted: e.target.value })
								}
							/>
							{errors.minJobsCompleted && (
								<p className={errorText}>{errors.minJobsCompleted}</p>
							)}
						</div>

						<div>
							<label
								htmlFor="hire-depth-edit"
								className="mb-1 block font-medium"
							>
								Maximum hire depth
							</label>
							<select
								id="hire-depth-edit"
								className={field}
								value={form.maxHireDepth}
								onChange={(e) =>
									setForm({ ...form, maxHireDepth: Number(e.target.value) })
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
						<legend className="mb-2 font-medium">Evaluator verification</legend>
						{(
							[
								["own_agent", "My agent evaluates outputs"],
								["aeon_verifier", "The Aeon Verifier evaluates outputs"],
							] as const
						).map(([value, label]) => (
							<label
								key={value}
								className="mr-6 inline-flex cursor-pointer items-center gap-2"
							>
								<input
									type="radio"
									name="evaluatorMode"
									checked={form.evaluatorMode === value}
									onChange={() => setForm({ ...form, evaluatorMode: value })}
								/>
								<span className="text-sm">{label}</span>
							</label>
						))}
					</fieldset>

					{statusMessage && (
						<p className={mutation.isError ? errorText : "text-moss text-sm"}>
							{statusMessage}
						</p>
					)}

					<div className="pt-2">
						<button
							type="submit"
							className={primary}
							disabled={hasErrors || mutation.isPending}
						>
							{mutation.isPending ? "Saving…" : "Save limits"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
