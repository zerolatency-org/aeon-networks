// apps/web/src/components/agents/steps/persona-step.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import {
	FALLBACK_MODELS,
	loadModels,
	modelKeys,
	modelRows,
	pickModel,
} from "@/lib/models";
import {
	estimateTokens,
	PERSONA_LIMIT,
	PERSONA_TEMPLATES,
	type PersonaTemplate,
	templateAction,
} from "@/lib/persona";
import { charCount, type StepErrors, type WizardDraft } from "@/lib/wizard";

import { errorText, field, hint, quiet } from "../styles";

type Props = {
	draft: WizardDraft;
	errors: StepErrors;
	patch: (p: Partial<WizardDraft>) => void;
};

export function PersonaStep({ draft, errors, patch }: Props) {
	const { data } = useQuery({
		queryKey: modelKeys.all,
		queryFn: () => loadModels(),
		staleTime: 5 * 60_000,
	});
	const models = data?.models ?? FALLBACK_MODELS;
	const count = charCount(draft.persona, PERSONA_LIMIT);

	// Keep a usable model selected, also when the list arrives after the first render.
	useEffect(() => {
		const pick = pickModel(models, draft.model);
		if (pick !== draft.model) patch({ model: pick });
	}, [models, draft.model, patch]);

	function applyTemplate(t: PersonaTemplate) {
		const action = templateAction(draft.persona, t);
		if (action === "same") return;
		if (
			action === "confirm" &&
			!window.confirm("Replace your persona with this template?")
		)
			return;
		patch({ persona: t.text });
	}

	return (
		<div className="space-y-6">
			<fieldset>
				<legend className="mb-2 font-medium">Model</legend>
				<div className="divide-border border-border bg-surface-1 divide-y rounded-xl border">
					{modelRows(models).map((row) => (
						<label
							key={row.id}
							className={`flex items-center gap-3 p-3 ${row.usable ? "cursor-pointer" : "opacity-50"}`}
						>
							<input
								type="radio"
								name="model"
								checked={draft.model === row.id}
								disabled={!row.usable}
								onChange={() => patch({ model: row.id })}
							/>
							<span className="flex-1">
								<span className="block">{row.label}</span>
								<span className="num text-fg-2">{row.price}</span>
							</span>
							<span className="text-fg-2 text-sm">Tools: {row.tools}</span>
						</label>
					))}
				</div>
				<p className={`${hint} mt-2`}>
					Prices are per million tokens, charged when the agent runs.
				</p>
				{errors.model && <p className={errorText}>{errors.model}</p>}
			</fieldset>

			<div>
				<label htmlFor="persona" className="mb-2 block font-medium">
					Persona <span className="text-fg-3">(optional)</span>
				</label>
				<div className="mb-2 flex flex-wrap gap-2">
					{PERSONA_TEMPLATES.map((t) => (
						<button
							type="button"
							key={t.id}
							className={quiet}
							onClick={() => applyTemplate(t)}
						>
							{t.label}
						</button>
					))}
				</div>
				<textarea
					id="persona"
					className={field}
					rows={8}
					value={draft.persona}
					onChange={(e) => patch({ persona: e.target.value })}
					placeholder="How should this agent talk and work?"
				/>
				<p className={`num ${count.over ? "text-coral" : "text-fg-3"}`}>
					{count.used}/{PERSONA_LIMIT} · about {estimateTokens(draft.persona)}{" "}
					tokens
				</p>
				<p className={hint}>
					Only your agent sees this. Aeon seals it and never shows it again.
				</p>
				{errors.persona && <p className={errorText}>{errors.persona}</p>}
			</div>
		</div>
	);
}
