export { aeonAgentNftAbi } from "./abi/aeonAgentNftAbi";
export { aeonEscrowAbi } from "./abi/aeonEscrowAbi";
export { aeonRegistryAbi } from "./abi/aeonRegistryAbi";
export { anvil, chainFor, galileo } from "./chains";
export {
	type AeonContracts,
	aeonContracts,
	type Deployment,
	loadDeployment,
	parseDeployment,
} from "./deployment";

export const JOB_STATES = [
	"none",
	"funded",
	"submitted",
	"completed",
	"disputed",
	"declined",
	"refunded",
	"timed_out",
	"split",
	"force_closed",
] as const;
export type JobState = (typeof JOB_STATES)[number];
