// apps/web/test/chat-cost.test.ts
import { describe, expect, test } from "bun:test";
import {
	calculateChatCost,
	costReadoutText,
	type ModelPricing,
} from "@/lib/chat-cost";

const listedModel: ModelPricing = {
	id: "glm-5.2",
	inputPrice: "1000000000", // 1 gwei / token
	outputPrice: "2000000000", // 2 gwei / token
};

describe("Chat cost calculation", () => {
	test("calculates exact cost in wei for input and output tokens", () => {
		// 100 * 10^9 + 50 * 2*10^9 = 100*10^9 + 100*10^9 = 200*10^9 wei
		const cost = calculateChatCost(listedModel, 100, 50);
		expect(cost.costWei).toBe(200000000000n);
		expect(cost.isListed).toBe(true);
	});

	test("formats cost in 0G text correctly", () => {
		// 10^18 wei = 1 0G
		const cost = calculateChatCost(
			{ id: "test", inputPrice: "1000000000000000", outputPrice: "0" },
			1000,
			0,
		);
		expect(cost.costWei).toBe(1000000000000000000n); // 1 0G
		expect(cost.formatted0G).toBe("1 0G");
	});

	test("returns 'not listed' when model has null inputPrice", () => {
		const cost = calculateChatCost(
			{ id: "custom", inputPrice: null, outputPrice: "1000" },
			100,
			50,
		);
		expect(cost.isListed).toBe(false);
		expect(cost.costWei).toBeNull();
		expect(cost.formatted0G).toBe("not listed");
	});

	test("returns 'not listed' when model has null outputPrice", () => {
		const cost = calculateChatCost(
			{ id: "custom", inputPrice: "1000", outputPrice: null },
			100,
			50,
		);
		expect(cost.isListed).toBe(false);
		expect(cost.costWei).toBeNull();
		expect(cost.formatted0G).toBe("not listed");
	});

	test("returns 'not listed' when model is missing altogether", () => {
		const cost = calculateChatCost(null, 100, 50);
		expect(cost.isListed).toBe(false);
		expect(cost.costWei).toBeNull();
		expect(cost.formatted0G).toBe("not listed");
	});

	test("costReadoutText formats readout line with token counts and cost", () => {
		const cost = calculateChatCost(listedModel, 100, 50);
		const readout = costReadoutText(cost, 150);
		expect(readout).toContain("150 tokens");
		expect(readout).toContain("0G");
	});

	test("costReadoutText shows 'not listed' message when price is unlisted", () => {
		const cost = calculateChatCost(null, 100, 50);
		const readout = costReadoutText(cost, 150);
		expect(readout).toBe("150 tokens · not listed");
	});

	test("handles zero tokens cleanly with 0 0G", () => {
		const cost = calculateChatCost(listedModel, 0, 0);
		expect(cost.costWei).toBe(0n);
		expect(cost.formatted0G).toBe("0 0G");
	});
});
