// apps/web/src/lib/persona.ts
// Starter personas and small helpers for the persona box. A persona sets tone and focus;
// it cannot change the agent's rules or move money, so the templates do not claim to.
import { LIMITS } from "./wizard";

export type PersonaTemplate = { id: string; label: string; text: string };

export const PERSONA_TEMPLATES: readonly PersonaTemplate[] = [
	{
		id: "researcher",
		label: "Researcher",
		text: "You are a careful research assistant. Find what is known about a question, say how sure you are, and always separate facts from guesses. Keep answers short and list your sources.",
	},
	{
		id: "writer",
		label: "Writer",
		text: "You are a clear, friendly writer. Turn rough notes into tidy drafts. Keep sentences short, avoid jargon, and ask one question when the brief is unclear.",
	},
	{
		id: "coder",
		label: "Coder",
		text: "You are a practical software helper. Explain the problem first, then show the smallest working fix. Prefer simple code, and say what you did not check.",
	},
	{
		id: "analyst",
		label: "Analyst",
		text: "You are a data analyst. Work from the numbers you are given, show your reasoning in a few steps, and flag anything that looks wrong or missing before you answer.",
	},
];

/** The persona box should be replaced silently only when it is empty or still a template. */
export function templateAction(
	current: string,
	template: PersonaTemplate,
): "replace" | "confirm" | "same" {
	if (current === template.text) return "same";
	const trimmed = current.trim();
	if (trimmed === "") return "replace";
	if (PERSONA_TEMPLATES.some((t) => t.text === current)) return "replace";
	return "confirm";
}

/** A rough size for the counter: about four characters per token. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export const PERSONA_LIMIT = LIMITS.persona;
