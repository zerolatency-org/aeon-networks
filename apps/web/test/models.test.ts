// apps/web/test/models.test.ts
import { describe, expect, test } from "bun:test";

import {
	FALLBACK_MODELS,
	loadModels,
	modelRows,
	parseModels,
	pickModel,
} from "@/lib/models";

const glm = {
	id: "glm-5.2",
	label: "GLM 5.2",
	toolCalling: true,
	inputPrice: null,
	outputPrice: null,
};
const priced = {
	id: "fast-1",
	label: "Fast 1",
	toolCalling: true,
	inputPrice: "2000000000000",
	outputPrice: "10000000000000",
};
const chatOnly = {
	id: "talk-1",
	label: "Talk 1",
	toolCalling: false,
	inputPrice: null,
	outputPrice: null,
};

describe("parseModels", () => {
	test("a good list passes, and prices stay as digit strings or null", () => {
		expect(parseModels({ models: [glm, priced] })).toEqual([glm, priced]);
	});

	test("an empty list, a bad price or a missing field is refused", () => {
		expect(parseModels({ models: [] })).toBeNull();
		expect(parseModels({ models: [{ ...glm, inputPrice: "1.5" }] })).toBeNull();
		expect(
			parseModels({ models: [{ ...glm, toolCalling: "yes" }] }),
		).toBeNull();
		expect(parseModels({ models: [{ label: "x" }] })).toBeNull();
		expect(parseModels(null)).toBeNull();
	});
});

describe("loadModels", () => {
	test("a good answer is used and marked as from the server", async () => {
		const f = async () =>
			new Response(JSON.stringify({ models: [priced] }), { status: 200 });
		expect(await loadModels(f)).toEqual({ models: [priced], source: "server" });
	});

	test("a missing route, a bad answer or a network error gives the fallback and never throws", async () => {
		const gone = async () => new Response("{}", { status: 404 });
		const odd = async () =>
			new Response(JSON.stringify({ models: [{ nope: 1 }] }), { status: 200 });
		const down = async () => {
			throw new TypeError("fetch failed");
		};
		for (const f of [gone, odd, down]) {
			expect(await loadModels(f)).toEqual({
				models: FALLBACK_MODELS,
				source: "fallback",
			});
		}
	});
});

describe("table rows and the default pick", () => {
	test("rows show tool support and a per-million price, or say the price is not listed", () => {
		const rows = modelRows([glm, priced, chatOnly]);
		expect(rows[0]).toMatchObject({
			tools: "Yes",
			price: "Not listed",
			usable: true,
		});
		expect(rows[1]?.price).toBe("2 in · 10 out");
		expect(rows[2]).toMatchObject({ tools: "No", usable: false });
	});

	test("the pick keeps a still-offered model, otherwise the first one that can use tools", () => {
		expect(pickModel([chatOnly, glm, priced], "fast-1")).toBe("fast-1");
		expect(pickModel([chatOnly, glm, priced], "gone")).toBe("glm-5.2");
		expect(pickModel([chatOnly, glm], chatOnly.id)).toBe("glm-5.2");
		expect(pickModel([chatOnly], null)).toBeNull();
	});
});
