// packages/harness/src/cost.ts
// Counts what one run used. The Router's x_0g_trace.billing.total_cost (neuron) is the
// truth; tokens x catalog price is the fallback when a response carried no trace.
import type { ModelInfo } from "./catalog";

export type RouterTrace = {
	request_id?: string;
	provider?: string;
	billing?: { input_cost?: string; output_cost?: string; total_cost?: string };
};

export class CostMeter {
	inputTokens = 0;
	outputTokens = 0;
	billedNeuron = 0n;
	readonly traceIds: string[] = [];
	private readonly pending: Promise<unknown>[] = [];

	constructor(readonly model: ModelInfo) {}

	/** Registers background work (reading a streamed trace) that settled() waits for. */
	track(work: Promise<unknown>) {
		this.pending.push(work);
	}

	/** Resolves once every tracked trace read has finished. Call before recording cost. */
	async settled() {
		await Promise.allSettled(this.pending);
	}

	addUsage(usage: { inputTokens?: number; outputTokens?: number }) {
		this.inputTokens += usage.inputTokens ?? 0;
		this.outputTokens += usage.outputTokens ?? 0;
	}

	addTrace(trace: RouterTrace) {
		if (trace.request_id) this.traceIds.push(trace.request_id);
		const total = trace.billing?.total_cost;
		if (total && /^\d+$/.test(total)) this.billedNeuron += BigInt(total);
	}

	/** Estimate from tokens, or null when the catalog has no prices for this model. */
	estimatedNeuron(): bigint | null {
		const { inputPrice, outputPrice } = this.model;
		if (inputPrice === undefined || outputPrice === undefined) return null;
		return (
			BigInt(this.inputTokens) * inputPrice +
			BigInt(this.outputTokens) * outputPrice
		);
	}

	/** Billed cost when the Router reported it, otherwise the estimate (or 0). */
	costNeuron(): bigint {
		if (this.traceIds.length > 0) return this.billedNeuron;
		return this.estimatedNeuron() ?? 0n;
	}
}
