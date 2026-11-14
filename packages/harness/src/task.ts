// packages/harness/src/task.ts
// What a client asks for, and the checks code can run on a result before any model does.
// A task's plaintext is a TaskSpec as JSON; plain text is accepted as { prompt: text }.
import { z } from "zod";

export const TaskSpec = z.object({
	v: z.literal(1).default(1),
	prompt: z.string().min(1).max(20_000),
	accept: z
		.object({
			format: z.enum(["text", "json"]).default("text"),
			/** for json: top-level fields the result must have */
			requiredFields: z.array(z.string().max(64)).max(32).default([]),
			/** phrases the result must contain (case-insensitive) */
			mustInclude: z.array(z.string().max(200)).max(16).default([]),
			maxChars: z.number().int().positive().max(1_000_000).optional(),
			/** what the evaluator model judges against, in the client's words */
			criteria: z.string().max(4000).default(""),
		})
		.default({
			format: "text",
			requiredFields: [],
			mustInclude: [],
			criteria: "",
		}),
});
export type TaskSpec = z.infer<typeof TaskSpec>;

export function parseTaskSpec(text: string): TaskSpec {
	try {
		const parsed = TaskSpec.safeParse(JSON.parse(text));
		if (parsed.success) return parsed.data;
	} catch {
		// not JSON: a plain-text task
	}
	return TaskSpec.parse({ prompt: text });
}

/**
 * The task's acceptance contract, checked by code. Returns the failed check codes;
 * an empty list means the model gets to judge the rest.
 */
export function checkResult(spec: TaskSpec, content: string): string[] {
	const failed: string[] = [];
	const a = spec.accept;
	if (a.maxChars !== undefined && content.length > a.maxChars) {
		failed.push("TOO_LONG");
	}
	if (a.format === "json") {
		let value: unknown;
		try {
			value = JSON.parse(content);
		} catch {
			failed.push("NOT_JSON");
		}
		if (value !== undefined) {
			const obj =
				value && typeof value === "object" && !Array.isArray(value)
					? (value as Record<string, unknown>)
					: null;
			if (!obj) failed.push("NOT_OBJECT");
			for (const f of a.requiredFields) {
				if (!obj || !(f in obj)) failed.push(`MISSING_FIELD:${f}`);
			}
		}
	}
	const lower = content.toLowerCase();
	for (const phrase of a.mustInclude) {
		if (!lower.includes(phrase.toLowerCase()))
			failed.push(`MISSING_PHRASE:${phrase}`);
	}
	return failed;
}
