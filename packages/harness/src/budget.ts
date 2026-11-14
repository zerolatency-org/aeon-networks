// packages/harness/src/budget.ts
import type { StopCondition, ToolSet } from "ai";

import type { CostMeter } from "./cost";

/** Stops the loop once the run's Router cost reaches `limit` neuron. */
export function budgetSpent(
	meter: CostMeter,
	limit: bigint,
): StopCondition<ToolSet> {
	return () => meter.costNeuron() >= limit;
}
