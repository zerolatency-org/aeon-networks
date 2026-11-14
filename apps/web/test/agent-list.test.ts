// apps/web/test/agent-list.test.ts
import { describe, expect, test } from "bun:test";

import { agentRow, listSummary, sortAgents } from "@/lib/agent-list";
import type { AgentView } from "@/lib/agents-parse";
import { avatarTint } from "@/lib/avatar";

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

describe("one row of the grid", () => {
	test("shows the name, the saved face, the balance and where it links", () => {
		const row = agentRow(agent());
		expect(row).toMatchObject({
			id: "a1",
			href: "/agents/a1",
			name: "Scout",
			description: "Finds papers",
			face: { kind: "preset", id: "p03" },
			balance: "0.05 0G",
			funding: "ready",
			wallet: "0x3eb…a2ab",
		});
	});

	test("an unnamed agent, a missing face and an unreadable balance all fall back gently", () => {
		const row = agentRow(
			agent({
				name: " ",
				avatarKind: null,
				avatarRef: null,
				balanceWei: null,
				agentWallet: null,
			}),
		);
		expect(row.name).toBe("Agent #7");
		expect(row.face.kind).toBe("dicebear");
		expect(row.balance).toBe("--");
		expect(row.funding).toBe("unknown");
		expect(row.wallet).toBeNull();
		expect(row.face).toEqual({
			kind: "dicebear",
			seed: "a1",
			bg: avatarTint("a1"),
		});
	});

	test("long descriptions are cut to one line", () => {
		const row = agentRow(agent({ description: "word ".repeat(80) }));
		expect(row.description.length).toBeLessThanOrEqual(120);
		expect(row.description.endsWith("…")).toBe(true);
	});
});

describe("the list", () => {
	test("newest first, and the input is not changed", () => {
		const list = [
			agent({ id: "old", createdAt: "2026-10-01T00:00:00.000Z" }),
			agent({ id: "new", createdAt: "2026-11-05T00:00:00.000Z" }),
			agent({ id: "mid", createdAt: "2026-10-20T00:00:00.000Z" }),
		];
		expect(sortAgents(list).map((a) => a.id)).toEqual(["new", "mid", "old"]);
		expect(list[0]?.id).toBe("old");
	});

	test("the summary counts agents and those that need funds", () => {
		expect(listSummary([])).toBe("No agents yet.");
		expect(listSummary([agent()])).toBe("1 agent.");
		const mixed = [
			agent(),
			agent({ id: "b", balanceWei: "0" }),
			agent({ id: "c", balanceWei: "100" }),
		];
		expect(listSummary(mixed)).toBe("3 agents. 2 need funds.");
		expect(listSummary([agent({ balanceWei: "0" })])).toBe(
			"1 agent. 1 needs funds.",
		);
	});

	test("an agent whose balance could not be read is not counted as needing funds", () => {
		expect(listSummary([agent({ balanceWei: null }), agent({ id: "b" })])).toBe(
			"2 agents.",
		);
	});
});
