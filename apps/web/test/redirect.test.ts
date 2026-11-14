// apps/web/test/redirect.test.ts
import { describe, expect, test } from "bun:test";

import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
	test("keeps a path on this site, with its query and hash", () => {
		expect(safeNext("/agents/12?tab=jobs#top")).toBe("/agents/12?tab=jobs#top");
		expect(safeNext("/settings")).toBe("/settings");
	});

	test("falls back for anything that could leave the site", () => {
		for (const bad of [
			undefined,
			null,
			"",
			"agents",
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"javascript:alert(1)",
			"/ok\nhttps://evil.example",
		]) {
			expect(safeNext(bad), String(bad)).toBe("/agents");
		}
		expect(safeNext("https://evil.example", "/settings")).toBe("/settings");
	});

	test("never sends someone back to the login page", () => {
		expect(safeNext("/login")).toBe("/agents");
		expect(safeNext("/login?next=/settings")).toBe("/agents");
		expect(safeNext("/login/")).toBe("/agents");
	});
});
