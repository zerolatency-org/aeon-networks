// apps/web/test/wagmi.test.ts
import { describe, expect, test } from "bun:test";
import { appChain } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";

describe("wagmiConfig", () => {
	test("exports a valid wagmi configuration", () => {
		expect(wagmiConfig).toBeDefined();
		expect(wagmiConfig.chains).toBeDefined();
		expect(wagmiConfig.chains.map((c) => c.id)).toContain(appChain.id);
	});

	test("configures injected and metamask connectors directly", () => {
		const connectors = wagmiConfig.connectors;
		expect(connectors.length).toBeGreaterThanOrEqual(1);

		const connectorIds = connectors.map((c) => c.id);
		expect(connectorIds).toContain("metaMask");
		expect(connectorIds).toContain("injected");
	});
});
