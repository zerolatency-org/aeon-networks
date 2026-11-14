// apps/web/src/components/agents/steps/identity-step.tsx
"use client";

import { PRESET_IDS } from "@/content/avatars";
import { AVATAR_TINTS } from "@/lib/avatar";
import { sameAvatar, shuffleFace, suggestAvatar } from "@/lib/avatar-choice";
import {
	charCount,
	LIMITS,
	type StepErrors,
	type WizardDraft,
} from "@/lib/wizard";

import { AgentFace } from "../agent-face";
import { errorText, field, hint, quiet } from "../styles";

type Props = {
	draft: WizardDraft;
	errors: StepErrors;
	patch: (p: Partial<WizardDraft>) => void;
};

export function IdentityStep({ draft, errors, patch }: Props) {
	const name = charCount(draft.name, LIMITS.name);
	const desc = charCount(draft.description, LIMITS.description);
	const generated = draft.avatar?.kind === "dicebear" ? draft.avatar : null;

	function setName(next: string) {
		// The suggested face follows the name until the owner picks a face themselves.
		const follows =
			draft.avatar === null ||
			sameAvatar(draft.avatar, suggestAvatar(draft.name));
		patch({ name: next, ...(follows ? { avatar: suggestAvatar(next) } : {}) });
	}

	return (
		<div className="space-y-6">
			<div>
				<label htmlFor="agent-name" className="mb-1 block font-medium">
					Name
				</label>
				<input
					id="agent-name"
					className={field}
					value={draft.name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Scout"
					aria-invalid={Boolean(errors.name)}
				/>
				<p className={`num ${name.over ? "text-coral" : "text-fg-3"}`}>
					{name.used}/{LIMITS.name}
				</p>
				{errors.name && <p className={errorText}>{errors.name}</p>}
			</div>

			<div>
				<label htmlFor="agent-desc" className="mb-1 block font-medium">
					Description <span className="text-fg-3">(optional)</span>
				</label>
				<textarea
					id="agent-desc"
					className={field}
					rows={3}
					value={draft.description}
					onChange={(e) => patch({ description: e.target.value })}
					placeholder="What is this agent good at?"
				/>
				<p className={`num ${desc.over ? "text-coral" : "text-fg-3"}`}>
					{desc.used}/{LIMITS.description}
				</p>
				{errors.description && (
					<p className={errorText}>{errors.description}</p>
				)}
			</div>

			<fieldset>
				<legend className="mb-2 font-medium">Face</legend>
				<div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
					{PRESET_IDS.map((id) => {
						const face = { kind: "preset" as const, id };
						const on = sameAvatar(draft.avatar, face);
						return (
							<button
								type="button"
								key={id}
								aria-pressed={on}
								aria-label={`Face ${id}`}
								onClick={() => patch({ avatar: face })}
								className={`rounded-xl p-0.5 ${on ? "ring-lumen-fg ring-2" : "ring-border ring-1"}`}
							>
								<AgentFace face={face} size={48} />
							</button>
						);
					})}
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					{generated && <AgentFace face={generated} size={48} />}
					<button
						type="button"
						className={quiet}
						onClick={() => patch({ avatar: shuffleFace() })}
					>
						{generated ? "Shuffle" : "Generate a face"}
					</button>
					{generated &&
						AVATAR_TINTS.map((bg) => (
							<button
								type="button"
								key={bg}
								aria-label={`Background ${bg}`}
								aria-pressed={generated.bg === bg}
								onClick={() => patch({ avatar: { ...generated, bg } })}
								className={`h-6 w-6 rounded-full ${generated.bg === bg ? "ring-fg ring-2" : "ring-border ring-1"}`}
								style={{ background: `var(--${bg})` }}
							/>
						))}
				</div>
				<p className={`${hint} mt-2`}>
					Pick one of 20 faces, or generate one from a seed.
				</p>
				{errors.avatar && <p className={errorText}>{errors.avatar}</p>}
			</fieldset>
		</div>
	);
}
