// apps/web/test/agent-tabs.test.ts
import { describe, expect, test } from "bun:test";

import { headerView, overviewStats } from "@/lib/agent-overview";
import { TABS, tabFromParam, tabHref } from "@/lib/agent-tabs";
import type { AgentView } from "@/lib/agents-parse";

const agent = (over: Partial<AgentView> = {}): AgentView => ({
	id: "a1",
	tokenId: "7",
	name: "Scout",
	description: "Finds papers",
	model: "glm-5.2",
	status: "active",
	avatarKind: "preset",
	avatarRef: "p03",
	agentWallet: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	balanceWei: "50000000000000000",
	createdAt: "2026-11-01T10:00:00.000Z",
	...over,
});

describe("tabs", () => {
	test("six tabs in a fixed order", () => {
		expect(TABS.map((t) => t.id)).toEqual([
			"overview",
			"wallet",
			"listing",
			"policy",
			"memory",
			"activity",
		]);
	});

	test("the tab comes from the address and falls back to the overview", () => {
		expect(tabFromParam("wallet")).toBe("wallet");
		expect(tabFromParam(["policy", "wallet"])).toBe("policy");
		for (const bad of [undefined, null, "", "nope", "WALLET", ["x"]])
			expect(tabFromParam(bad)).toBe("overview");
	});

	test("the overview has the plain address, the others add the tab", () => {
		expect(tabHref("a1", "overview")).toBe("/agents/a1");
		expect(tabHref("a1", "listing")).toBe("/agents/a1?tab=listing");
	});
});

describe("the header and the overview numbers", () => {
	test("the header names the agent, its status and its funding", () => {
		expect(headerView(agent())).toMatchObject({
			name: "Scout",
			status: "Active",
			tone: "ok",
			funding: "ready",
			balance: "0.05 0G",
		});
		expect(headerView(agent({ name: " ", status: "paused" }))).toMatchObject({
			name: "Agent #7",
			status: "paused",
			tone: "warn",
		});
	});

	test("without job data the earnings and jobs say they are not there yet instead of showing zero", () => {
		const stats = overviewStats(agent(), null);
		const by = (key: string) => stats.find((s) => s.key === key);
		expect(by("balance")).toMatchObject({ value: "0.05 0G" });
		expect(by("earnings")).toMatchObject({ value: "--" });
		expect(by("earnings")?.note).toContain("jobs");
		expect(by("jobs")?.value).toBe("--");
		expect(by("minted")?.value).toBe("2026-11-01");
		expect(by("token")?.value).toBe("#7");
	});

	test("with job data they show the real numbers", () => {
		const stats = overviewStats(agent(), {
			earningsWei: "250000000000000000",
			jobsCompleted: 12,
		});
		expect(stats.find((s) => s.key === "earnings")).toMatchObject({
			value: "0.25 0G",
			note: null,
		});
		expect(stats.find((s) => s.key === "jobs")).toMatchObject({
			value: "12",
			note: null,
		});
	});
});
