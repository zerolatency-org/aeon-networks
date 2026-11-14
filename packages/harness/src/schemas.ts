// packages/harness/src/schemas.ts
// Structured outputs the worker roles return (Backend Blueprint). The worker parses these;
// it never parses free text from a model.
import { z } from "zod";

export const Verdict = z.object({
	verdict: z.enum(["pass", "fail", "unsure"]),
	score: z.number().min(0).max(1),
	failedCriteria: z.array(z.string()).max(20),
	reasons: z.string().max(2000),
});
export type Verdict = z.infer<typeof Verdict>;

export const ProviderResult = z.object({
	summary: z.string().max(500),
	content: z.string(),
	contentType: z.string().default("text/markdown"),
});
export type ProviderResult = z.infer<typeof ProviderResult>;
