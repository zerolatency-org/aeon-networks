// apps/web/test/agents-api.test.ts
import { describe, expect, test } from "bun:test";

import {
	agentKeys,
	confirmAgent,
	getAgent,
	getPolicy,
	listAgents,
	prepareAgent,
	setPolicy,
} from "@/lib/agents-api";
import { ApiError } from "@/lib/siwe-api";

const WALLET = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab";
const tx = { chainId: 16602, to: WALLET, value: "1000", data: "0xabcd" };
const agent = {
	id: "a1",
	tokenId: "7",
	name: "Scout",
	description: "",
	model: "glm-5.2",
	status: "active",
	avatarKind: null,
	avatarRef: null,
	agentWallet: WALLET,
	balanceWei: "0",
	createdAt: "2026-11-12T10:00:00.000Z",
};

type Seen = { path: string; init?: RequestInit };
function fake(status: number, body: unknown) {
	const seen: Seen[] = [];
	const fetchImpl = async (path: string, init?: RequestInit) => {
		seen.push({ path, ...(init ? { init } : {}) });
		return new Response(JSON.stringify(body), { status });
	};
	return { seen, fetchImpl };
}

describe("agents api", () => {
	test("list and get call the right paths with the session cookie and return checked data", async () => {
		const a = fake(200, { agents: [agent] });
		expect((await listAgents(a.fetchImpl)).map((x) => x.id)).toEqual(["a1"]);
		expect(a.seen[0]?.path).toBe("/api/agents");
		expect(a.seen[0]?.init?.method).toBe("GET");
		expect(a.seen[0]?.init?.credentials).toBe("include");

		const b = fake(200, agent);
		expect((await getAgent("a/1", b.fetchImpl)).tokenId).toBe("7");
		expect(b.seen[0]?.path).toBe("/api/agents/a%2F1");
	});

	test("prepare and confirm send JSON bodies and return the parsed answers", async () => {
		const body = { name: "S", description: "", model: "glm-5.2", persona: "p" };
		const p = fake(200, {
			draftId: "d1",
			agentWallet: WALLET,
			expiresAt: "x",
			mint: tx,
		});
		const prepared = await prepareAgent(body, p.fetchImpl);
		expect(prepared.draftId).toBe("d1");
		expect(p.seen[0]?.path).toBe("/api/agents/prepare");
		expect(JSON.parse(String(p.seen[0]?.init?.body))).toEqual(body);

		const c = fake(200, { agent, authorize: tx });
		const confirmed = await confirmAgent(
			{ draftId: "d1", txHash: `0x${"a".repeat(64)}` },
			c.fetchImpl,
		);
		expect(confirmed.authorize.to).toBe(WALLET);
		expect(c.seen[0]?.path).toBe("/api/agents/confirm");
	});

	test("an error answer becomes ApiError with its code, a code-less one with HTTP_status", async () => {
		const withCode = fake(409, { code: "NOT_MINED" });
		const e1 = await confirmAgent(
			{ draftId: "d", txHash: "0x" },
			withCode.fetchImpl,
		).catch((e) => e);
		expect(e1).toBeInstanceOf(ApiError);
		expect(e1).toMatchObject({ code: "NOT_MINED", status: 409 });
		const bare = fake(502, null);
		const e2 = await listAgents(bare.fetchImpl).catch((e) => e);
		expect(e2).toMatchObject({ code: "HTTP_502", status: 502 });
	});

	test("an answer in the wrong shape is a BAD_RESPONSE, never a crash later", async () => {
		const wrong = fake(200, { agents: [{ nope: true }] });
		const e = await listAgents(wrong.fetchImpl).catch((x) => x);
		expect(e).toMatchObject({ code: "BAD_RESPONSE" });
	});

	test("query keys nest, so invalidating the list or all agents works", () => {
		expect(agentKeys.list().slice(0, 1)).toEqual([...agentKeys.all]);
		expect(agentKeys.one("a1")).toEqual(["agents", "one", "a1"]);
	});
});

describe("policy calls", () => {
	const pol = {
		perJobCap: "100",
		dailyCap: "300",
		minJobsCompleted: 0,
		maxHireDepth: 1,
		evaluatorMode: "own_agent",
	};
	test("getPolicy reads and setPolicy PUTs the body", async () => {
		const f = fake(200, pol);
		expect(await getPolicy("a/b", f.fetchImpl)).toEqual(pol);
		expect(f.seen[0]?.path).toBe("/api/agents/a%2Fb/policy");
		await setPolicy("x", pol, f.fetchImpl);
		expect(f.seen[1]?.init?.method).toBe("PUT");
		expect(JSON.parse(String(f.seen[1]?.init?.body))).toEqual(pol);
	});
});
