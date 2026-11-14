// packages/harness/src/registry.ts
// Roles and tools are registered by name. A role lists the tool names it may use;
// building a role's agent picks exactly those tools, so a chat agent can never reach
// a tool that only the provider role should have.
import {
	isStepCount,
	type LanguageModel,
	type Tool,
	ToolLoopAgent,
	type ToolSet,
} from "ai";

import { budgetSpent } from "./budget";
import type { RoleName, RunContext } from "./context";
import type { CostMeter } from "./cost";

/** OpenAI-style function names: letters, digits, _ and - only. */
const WIRE_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

export type ToolRegistry = ReadonlyMap<string, Tool>;

export function defineTools(tools: Record<string, Tool>): ToolRegistry {
	for (const name of Object.keys(tools)) {
		if (!WIRE_NAME.test(name)) throw new Error(`bad tool name "${name}"`);
	}
	return new Map(Object.entries(tools));
}

export type RoleSpec = {
	name: RoleName;
	/** Fixed instructions. Untrusted text (personas, tasks) is quoted inside, never obeyed. */
	instructions: (ctx: RunContext, extra: { persona?: string }) => string;
	tools: readonly string[];
	maxSteps: number;
};

export function defineRole(spec: RoleSpec): RoleSpec {
	if (spec.maxSteps < 1) throw new Error("maxSteps must be at least 1");
	return spec;
}

export class MissingToolError extends Error {
	constructor(readonly tool: string) {
		super(`MISSING_TOOL: ${tool}`);
		this.name = "MissingToolError";
	}
}

/** Builds the ToolLoopAgent for one run of a role. */
export function createRoleAgent(opts: {
	role: RoleSpec;
	model: LanguageModel;
	tools: ToolRegistry;
	ctx: RunContext;
	meter: CostMeter;
	persona?: string;
	maxRetries?: number;
}): ToolLoopAgent<never, ToolSet> {
	const selected: ToolSet = {};
	for (const name of opts.role.tools) {
		const t = opts.tools.get(name);
		if (!t) throw new MissingToolError(name);
		selected[name] = t;
	}
	return new ToolLoopAgent({
		model: opts.model,
		instructions: opts.role.instructions(opts.ctx, { persona: opts.persona }),
		tools: selected,
		stopWhen: [
			isStepCount(opts.role.maxSteps),
			budgetSpent(opts.meter, opts.ctx.budgetNeuron),
		],
		maxRetries: opts.maxRetries ?? 2,
		onStepFinish: ({ usage }) => opts.meter.addUsage(usage),
	});
}
