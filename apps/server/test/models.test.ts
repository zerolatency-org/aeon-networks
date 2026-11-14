// apps/server/test/models.test.ts
// GET /api/models lists the same catalogue that `prepare` checks against.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { modelView } from "@aeon/api/routers/models";

import { setupTestApp } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => {
	t = await setupTestApp();
});
afterAll(async () => {
	await t.close();
});

describe("models", () => {
	test("prices become digit strings, and a missing price is null", () => {
		expect(
			modelView({
				id: "m",
				label: "M",
				toolCalling: true,
				inputPrice: 2n,
				outputPrice: 10n,
			}),
		).toEqual({
			id: "m",
			label: "M",
			toolCalling: true,
			inputPrice: "2",
			outputPrice: "10",
		});
		expect(
			modelView({ id: "m", label: "M", toolCalling: false }),
		).toMatchObject({
			inputPrice: null,
			outputPrice: null,
		});
	});

	test("the route is public and, without chain services, lists the default catalogue", async () => {
		const res = await t.app.request("/api/models");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			models: [
				{
					id: "glm-5.2",
					label: "GLM 5.2",
					toolCalling: true,
					inputPrice: null,
					outputPrice: null,
				},
				{
					id: "qwen3-omni-flash",
					label: "Qwen3 Omni Flash",
					toolCalling: true,
					inputPrice: "1170000000000",
					outputPrice: "4710000000000",
				},
			],
		});
	});
});
