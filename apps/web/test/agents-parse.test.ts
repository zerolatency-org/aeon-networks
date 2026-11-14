// apps/web/test/agents-parse.test.ts
import { describe, expect, test } from "bun:test";

import {
	mintProblem,
	parseAgent,
	parseAgentList,
	parseConfirmed,
	parsePolicy,
	parsePrepared,
	parseTx,
} from "@/lib/agents-parse";
import { ApiError } from "@/lib/siwe-api";

const WALLET = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab" as const;
const tx = {
	chainId: 16602,
	to: WALLET,
	value: "1000",
	data: "0xabcd" as const,
};
const agent = {
	id: "5c1e0a52-0000-4000-8000-000000000001",
	tokenId: "7",
	name: "Scout",
	description: "Finds papers",
	model: "glm-5.2",
	status: "active",
	avatarKind: null,
	avatarRef: null,
	agentWallet: WALLET,
	balanceWei: "0",
	createdAt: "2026-11-12T10:00:00.000Z",
};

describe("parseAgent and parseAgentList", () => {
	test("a good agent passes and keeps its fields, an unreadable balance stays null", () => {
		expect(parseAgent(agent)?.name).toBe("Scout");
		expect(parseAgent({ ...agent, balanceWei: null })?.balanceWei).toBeNull();
		expect(parseAgent({ ...agent, description: null })?.description).toBe("");
		expect(parseAgent({ ...agent, agentWallet: null })?.agentWallet).toBeNull();
	});

	test("anything off is refused: ids, token, wallet, balance, missing fields", () => {
		expect(parseAgent(null)).toBeNull();
		expect(parseAgent({ ...agent, id: "" })).toBeNull();
		expect(parseAgent({ ...agent, tokenId: "-1" })).toBeNull();
		expect(parseAgent({ ...agent, agentWallet: "0x12" })).toBeNull();
		expect(parseAgent({ ...agent, balanceWei: "1.5" })).toBeNull();
		expect(parseAgent({ ...agent, name: undefined })).toBeNull();
	});

	test("a list needs every agent to be good", () => {
		expect(
			parseAgentList({ agents: [agent, { ...agent, id: "b" }] }),
		).toHaveLength(2);
		expect(parseAgentList({ agents: [] })).toEqual([]);
		expect(parseAgentList({ agents: [agent, { nope: 1 }] })).toBeNull();
		expect(parseAgentList({})).toBeNull();
	});
});

describe("transactions and mint answers", () => {
	test("a transaction needs a chain id, a 20-byte address, wei digits and even-length hex data", () => {
		expect(parseTx(tx)).toEqual(tx);
		expect(parseTx({ ...tx, chainId: 0 })).toBeNull();
		expect(parseTx({ ...tx, to: "0x123" })).toBeNull();
		expect(parseTx({ ...tx, value: "1e18" })).toBeNull();
		expect(parseTx({ ...tx, data: "0xabc" })).toBeNull();
		expect(parseTx({ ...tx, data: "abcd" })).toBeNull();
	});

	test("prepare and confirm answers are checked as a whole", () => {
		const prepared = {
			draftId: "d1",
			agentWallet: WALLET,
			expiresAt: "2026-11-13T10:00:00.000Z",
			mint: tx,
		};
		expect(parsePrepared(prepared)?.mint.value).toBe("1000");
		expect(parsePrepared({ ...prepared, mint: { ...tx, to: "x" } })).toBeNull();
		expect(parsePrepared({ ...prepared, draftId: "" })).toBeNull();
		expect(
			parseConfirmed({ agent, authorize: { ...tx, value: "0" } })?.agent
				.tokenId,
		).toBe("7");
		expect(parseConfirmed({ agent, authorize: null })).toBeNull();
		expect(parseConfirmed({ agent: { id: 1 }, authorize: tx })).toBeNull();
	});
});

describe("mintProblem", () => {
	test("every backend mint code has plain words, and only NOT_MINED style codes are retryable", () => {
		const codes = [
			"UNKNOWN_MODEL",
			"NOT_MINED",
			"MINT_FAILED",
			"MINT_NOT_FOUND",
			"FORBIDDEN",
			"MINT_MISMATCH",
			"ALREADY_CONFIRMED",
			"TX_ALREADY_USED",
			"NOT_FOUND",
			"SERVICE_UNAVAILABLE",
			"WALLET_REQUIRED",
			"UNAUTHORIZED",
		];
		for (const code of codes) {
			const p = mintProblem(new ApiError(code, 400));
			expect(p.code).toBe(code);
			expect(p.message.length, code).toBeGreaterThan(10);
			expect(p.message, code).not.toContain(code);
		}
		expect(mintProblem(new ApiError("NOT_MINED", 409)).retryable).toBe(true);
		expect(mintProblem(new ApiError("MINT_MISMATCH", 400)).retryable).toBe(
			false,
		);
	});

	test("unknown codes and network failures are handled without leaking raw errors", () => {
		expect(mintProblem(new ApiError("WEIRD", 500))).toMatchObject({
			code: "WEIRD",
			retryable: true,
		});
		expect(mintProblem(new ApiError("WEIRD", 400)).retryable).toBe(false);
		expect(mintProblem(new TypeError("fetch failed"))).toMatchObject({
			code: "NETWORK",
			retryable: true,
		});
	});
});

describe("parsePolicy", () => {
	const ok = {
		perJobCap: "100",
		dailyCap: "300",
		minJobsCompleted: 0,
		maxHireDepth: 1,
		evaluatorMode: "own_agent" as const,
	};
	test("accepts a policy and rejects bad caps", () => {
		expect(parsePolicy(ok)).toEqual(ok);
		expect(parsePolicy({ ...ok, perJobCap: "-1" })).toBeNull();
		expect(parsePolicy({ ...ok, maxHireDepth: 1.5 })).toBeNull();
		expect(parsePolicy(null)).toBeNull();
	});
});
