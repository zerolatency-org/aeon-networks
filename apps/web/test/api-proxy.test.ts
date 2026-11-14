// apps/web/test/api-proxy.test.ts
import { describe, expect, test } from "bun:test";

import { API_DEFAULT, apiRewrites } from "@/lib/api-proxy";

describe("apiRewrites", () => {
	test("forwards /api and /rpc to the backend", () => {
		expect(apiRewrites("https://api.example.com")).toEqual([
			{
				source: "/api/:path*",
				destination: "https://api.example.com/api/:path*",
			},
			{
				source: "/rpc/:path*",
				destination: "https://api.example.com/rpc/:path*",
			},
		]);
	});

	test("falls back to the local API when the variable is unset or blank", () => {
		for (const raw of [undefined, "", "   "]) {
			expect(apiRewrites(raw)[0]?.destination).toBe(
				`${API_DEFAULT}/api/:path*`,
			);
		}
	});

	test("trims spaces and trailing slashes", () => {
		expect(apiRewrites(" http://localhost:4000// ")[1]?.destination).toBe(
			"http://localhost:4000/rpc/:path*",
		);
	});

	test("rejects a value that is not a URL and names the variable", () => {
		expect(() => apiRewrites("not a url")).toThrow(/API_URL/);
	});
});
