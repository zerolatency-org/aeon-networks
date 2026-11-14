// apps/web/test/network.test.ts
import { describe, expect, test } from "bun:test";

import { networkState } from "@/lib/network";
import { COLOR_TOKENS } from "@/lib/tokens";
import { WALLET_COLORS } from "@/lib/wallet-theme";

describe("networkState", () => {
	test("a wallet that is not connected has no network", () => {
		expect(
			networkState({ isConnected: false, chainId: undefined }, 16602),
		).toBe("disconnected");
		expect(networkState({ isConnected: false, chainId: 16602 }, 16602)).toBe(
			"disconnected",
		);
	});

	test("a connected wallet on the right chain is ready", () => {
		expect(networkState({ isConnected: true, chainId: 16602 }, 16602)).toBe(
			"ready",
		);
	});

	test("a connected wallet on any other chain, or an unknown one, is on the wrong network", () => {
		expect(networkState({ isConnected: true, chainId: 1 }, 16602)).toBe(
			"wrong-network",
		);
		expect(networkState({ isConnected: true, chainId: undefined }, 16602)).toBe(
			"wrong-network",
		);
	});
});

describe("wallet theme", () => {
	test("every color is an Aeon token, never a literal color", () => {
		const names = new Set<string>(COLOR_TOKENS);
		for (const [key, value] of Object.entries(WALLET_COLORS)) {
			const m = /^var\(--([a-z0-9-]+)\)$/.exec(value);
			expect(m, key).not.toBeNull();
			expect(names.has(m?.[1] ?? ""), `${key} -> ${value}`).toBe(true);
		}
	});

	test("the accent is Lumen with its dark ink on top", () => {
		expect(WALLET_COLORS.accentColor).toBe("var(--lumen)");
		expect(WALLET_COLORS.accentColorForeground).toBe("var(--lumen-ink)");
	});
});
