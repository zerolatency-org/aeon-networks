// apps/web/test/chain.test.ts
import { describe, expect, test } from "bun:test";

import { addressUrl, appChain, GALILEO_ID, webChain } from "@/lib/chain";
import { env } from "@/lib/env";

const custom = {
	rpcUrl: "https://rpc.example.com",
	explorerUrl: "https://scan.example.com",
};

describe("webChain", () => {
	test("is Galileo: chain 16602 with the 0G currency", () => {
		const chain = webChain(custom);
		expect(GALILEO_ID).toBe(16602);
		expect(chain.id).toBe(16602);
		expect(chain.nativeCurrency.symbol).toBe("0G");
		expect(chain.nativeCurrency.decimals).toBe(18);
	});

	test("takes its RPC and explorer from the arguments", () => {
		const chain = webChain(custom);
		expect(chain.rpcUrls.default.http).toEqual(["https://rpc.example.com"]);
		expect(chain.blockExplorers?.default.url).toBe("https://scan.example.com");
	});

	test("appChain follows the env values", () => {
		expect(appChain.rpcUrls.default.http[0]).toBe(env.rpcUrl);
		expect(appChain.blockExplorers?.default.url).toBe(env.explorerUrl);
	});
});

describe("addressUrl", () => {
	test("links to the address page on the explorer", () => {
		const a = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2aB";
		expect(addressUrl(a)).toBe(`${env.explorerUrl}/address/${a}`);
	});
});
