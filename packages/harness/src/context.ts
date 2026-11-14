// packages/harness/src/context.ts
// The typed runtime context every run carries. Tools read it; the model never sees it.
import { z } from "zod";

export const ROLES = ["chat", "provider", "buyer", "evaluator"] as const;
export type RoleName = (typeof ROLES)[number];

export const RunContext = z.object({
	agentId: z.string().uuid(),
	tokenId: z.bigint().nonnegative(),
	ownerUserId: z.string().nullable(),
	role: z.enum(ROLES),
	jobId: z.bigint().optional(),
	hireDepth: z.number().int().min(0),
	/** Router cost (neuron) after which the run stops. */
	budgetNeuron: z.bigint().positive(),
});

export type RunContext = z.infer<typeof RunContext>;
