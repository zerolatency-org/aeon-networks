// apps/server/test/health.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { setupTestApp } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => {
	t = await setupTestApp();
});
afterAll(() => t.close());

describe("GET /health", () => {
	test("returns 200 with status, version and database reachability", async () => {
		const res = await t.app.request("/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: "ok",
			version: "test",
			db: true,
		});
	});
});
