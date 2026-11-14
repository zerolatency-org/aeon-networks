// packages/harness/src/index.ts
export { budgetSpent } from "./budget";
export {
	type Catalog,
	DEFAULT_CATALOG,
	DEFAULT_MODEL,
	defineCatalog,
	type ModelInfo,
	requireModel,
	UnknownModelError,
} from "./catalog";
export { ROLES, type RoleName, RunContext } from "./context";
export { CostMeter, type RouterTrace } from "./cost";
export {
	type RouterConfig,
	type RouterErrorCode,
	routerErrorCode,
	routerModel,
	traceCapturingFetch,
} from "./model";
export {
	DEFAULT_POLICY,
	decideHire,
	type HireDecision,
	type HireRequest,
	type SpendingPolicy,
	utcDayStart,
} from "./policy";
export {
	createRoleAgent,
	defineRole,
	defineTools,
	MissingToolError,
	type RoleSpec,
	type ToolRegistry,
} from "./registry";
export { chatRole } from "./roles/chat";
export {
	EVALUATOR_INSTRUCTIONS,
	evaluatorPrompt,
	judge,
} from "./roles/evaluator";
export { providerRole, quoteTask } from "./roles/provider";
export { ProviderResult, Verdict } from "./schemas";
export { checkResult, parseTaskSpec, TaskSpec } from "./task";
export { walletBalanceTool } from "./tools/wallet";
