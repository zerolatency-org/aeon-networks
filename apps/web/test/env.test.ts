// apps/web/test/env.test.ts
import { describe, expect, test } from "bun:test";

import { DEFAULTS, readEnv } from "@/lib/env";

describe("readEnv", () => {
	test("falls back to local defaults when nothing is set", () => {
		expect(readEnv({})).toEqual(DEFAULTS);
	});

	test("treats blank values as unset", () => {
		const env = readEnv({
			NEXT_PUBLIC_API_URL: "   ",
			NEXT_PUBLIC_RPC_URL: "",
		});
		expect(env.apiUrl).toBe(DEFAULTS.apiUrl);
		expect(env.rpcUrl).toBe(DEFAULTS.rpcUrl);
	});

	test("trims spaces and trailing slashes", () => {
		const env = readEnv({
			NEXT_PUBLIC_API_URL: " https://aeon.example.com/// ",
			NEXT_PUBLIC_EXPLORER_URL: "https://scan.example.com/",
		});
		expect(env.apiUrl).toBe("https://aeon.example.com");
		expect(env.explorerUrl).toBe("https://scan.example.com");
	});

	test("rejects a value that is not a URL and names the variable", () => {
		expect(() => readEnv({ NEXT_PUBLIC_RPC_URL: "not a url" })).toThrow(
			/NEXT_PUBLIC_RPC_URL/,
		);
	});

	test("keeps the WalletConnect project id as plain text", () => {
		expect(
			readEnv({ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: " abc123 " })
				.walletConnectProjectId,
		).toBe("abc123");
	});
});
