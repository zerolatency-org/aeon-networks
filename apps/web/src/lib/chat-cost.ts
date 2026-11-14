// apps/web/src/lib/chat-cost.ts
import { formatOg } from "./format";

export type ModelPricing = {
	id: string;
	inputPrice?: string | null;
	outputPrice?: string | null;
};

export type ChatCostResult = {
	costWei: bigint | null;
	formatted0G: string;
	isListed: boolean;
};

export function calculateChatCost(
	model: ModelPricing | null,
	promptTokens: number,
	completionTokens: number,
): ChatCostResult {
	if (
		!model ||
		model.inputPrice === null ||
		model.inputPrice === undefined ||
		model.outputPrice === null ||
		model.outputPrice === undefined
	) {
		return {
			costWei: null,
			formatted0G: "not listed",
			isListed: false,
		};
	}

	try {
		const inRate = BigInt(model.inputPrice);
		const outRate = BigInt(model.outputPrice);
		const p = BigInt(Math.max(0, promptTokens));
		const c = BigInt(Math.max(0, completionTokens));

		const costWei = p * inRate + c * outRate;
		return {
			costWei,
			formatted0G: `${formatOg(costWei)} 0G`,
			isListed: true,
		};
	} catch {
		return {
			costWei: null,
			formatted0G: "not listed",
			isListed: false,
		};
	}
}

export function costReadoutText(
	cost: ChatCostResult,
	totalTokens: number,
): string {
	if (!cost.isListed) {
		return `${totalTokens} tokens · not listed`;
	}
	return `${totalTokens} tokens · ${cost.formatted0G}`;
}
