// apps/web/src/lib/review.ts
// What the review step shows: one row per choice, with the step to go back to for fixing it.
import type { ModelView } from "./models";
import { estimateTokens } from "./persona";
import { describePolicy, isDefaultPolicy } from "./policy-form";
import { firstBlockedStep, STEPS, type WizardDraft } from "./wizard";

export type ReviewRow = {
	key: "name" | "description" | "face" | "model" | "persona" | "limits";
	label: string;
	/** the main line */
	value: string;
	/** extra lines under the value (the limits are several sentences) */
	details: string[];
	/** index into STEPS, for the Edit link */
	step: number;
};

const at = (id: (typeof STEPS)[number]) => STEPS.indexOf(id);

export function reviewRows(
	draft: WizardDraft,
	models: ModelView[],
): ReviewRow[] {
	const model = models.find((m) => m.id === draft.model);
	const persona = draft.persona.trim();
	const face = draft.avatar;
	return [
		{
			key: "name",
			label: "Name",
			value: draft.name.trim() || "Not set",
			details: [],
			step: at("identity"),
		},
		{
			key: "description",
			label: "Description",
			value: draft.description.trim() || "None",
			details: [],
			step: at("identity"),
		},
		{
			key: "face",
			label: "Face",
			value: !face
				? "Not chosen"
				: face.kind === "preset"
					? `Preset ${face.id}`
					: "Generated face",
			details: [],
			step: at("identity"),
		},
		{
			key: "model",
			label: "Model",
			value: draft.model ? (model?.label ?? draft.model) : "Not chosen",
			details: [],
			step: at("persona"),
		},
		{
			key: "persona",
			label: "Persona",
			value:
				persona === ""
					? "None"
					: `${draft.persona.length} characters, about ${estimateTokens(draft.persona)} tokens`,
			details: persona === "" ? ["The agent uses its default behavior."] : [],
			step: at("persona"),
		},
		{
			key: "limits",
			label: "Spending limits",
			value: !draft.policy
				? "Default limits"
				: isDefaultPolicy(draft.policy)
					? "Default limits"
					: "Custom limits",
			details: draft.policy ? describePolicy(draft.policy) : [],
			step: at("policy"),
		},
	];
}

/** Ready to mint when steps one to three are clean. Otherwise, the step to send the owner back to. */
export function reviewStatus(draft: WizardDraft): {
	ready: boolean;
	fixStep: number | null;
} {
	const blocked = firstBlockedStep(draft, at("review"));
	return blocked === -1
		? { ready: true, fixStep: null }
		: { ready: false, fixStep: blocked };
}
