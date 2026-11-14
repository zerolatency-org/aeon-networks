// apps/web/test/mint-runner.test.ts
import { describe, expect, test } from "bun:test";

import type {
	AvatarChoice,
	Confirmed,
	Hex,
	PolicyInput,
	Prepared,
} from "@/lib/agents-parse";
import { initialProgress, type MintEvent, mintReducer } from "@/lib/mint-flow";
import {
	CONFIRM_ATTEMPTS,
	CONFIRM_WAIT_MS,
	type MintDeps,
	newSession,
	prepareInput,
	runMint,
	walletProblem,
} from "@/lib/mint-runner";
import { ApiError } from "@/lib/siwe-api";
import type { WizardDraft } from "@/lib/wizard";

const WALLET = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab" as Hex;
const mintTx = {
	chainId: 16602,
	to: WALLET,
	value: "100000000000000000",
	data: "0xaa" as Hex,
};
const authTx = { chainId: 16602, to: WALLET, value: "0", data: "0xbb" as Hex };
const prepared: Prepared = {
	draftId: "d1",
	agentWallet: WALLET,
	expiresAt: "x",
	mint: mintTx,
};
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
	balanceWei: null,
	createdAt: "x",
};
const confirmed: Confirmed = { agent, authorize: authTx };
const face: AvatarChoice = { kind: "preset", id: "p03" };
const limits: PolicyInput = {
	perJobCap: "1",
	dailyCap: "2",
	minJobsCompleted: 0,
	maxHireDepth: 1,
	evaluatorMode: "own_agent",
};
const draft: WizardDraft = {
	name: "  Scout ",
	description: " Finds papers ",
	avatar: face,
	model: "glm-5.2",
	persona: "You find papers.",
	policy: limits,
};

/** Fake services that record what was called, in order. Each can be replaced per test. */
function fakes(over: Partial<MintDeps> = {}) {
	const calls: string[] = [];
	const deps: MintDeps = {
		prepare: async () => (calls.push("prepare"), prepared),
		sendTx: async (tx) => (
			calls.push(`send:${tx.data}`),
			`0x${tx.data === "0xaa" ? "11" : "22"}`.padEnd(66, "0") as Hex
		),
		waitMined: async () => (calls.push("mined"), "success"),
		confirm: async () => (calls.push("confirm"), confirmed),
		saveAvatar: async () => void calls.push("avatar"),
		savePolicy: async () => void calls.push("policy"),
		sleep: async (ms) => void calls.push(`sleep:${ms}`),
		...over,
	};
	return { calls, deps };
}

/** Collects events and feeds them through the real reducer, like the page will. */
function tracker() {
	const events: MintEvent[] = [];
	let state = mintReducer(initialProgress, { type: "start" });
	return {
		events,
		emit: (e: MintEvent) => {
			events.push(e);
			state = mintReducer(state, e);
		},
		get state() {
			return state;
		},
	};
}

describe("a clean mint", () => {
	test("runs every step in order and ends done", async () => {
		const { calls, deps } = fakes();
		const t = tracker();
		expect(await runMint(draft, newSession(), deps, t.emit)).toBe("done");
		expect(calls).toEqual([
			"prepare",
			"send:0xaa",
			"mined",
			"confirm",
			"send:0xbb",
			"mined",
			"avatar",
			"policy",
		]);
		expect(t.events.filter((e) => e.type === "advance")).toHaveLength(5);
		expect(t.state).toMatchObject({
			status: "done",
			feeWei: "100000000000000000",
		});
	});

	test("prepare gets the trimmed name and description, the model and the persona, and nothing else", async () => {
		const seen: unknown[] = [];
		const { deps } = fakes({ prepare: async (i) => (seen.push(i), prepared) });
		await runMint(draft, newSession(), deps, () => {});
		expect(seen[0]).toEqual({
			name: "Scout",
			description: "Finds papers",
			model: "glm-5.2",
			persona: "You find papers.",
		});
		expect(prepareInput({ ...draft, model: null })).toBeNull();
		expect(prepareInput({ ...draft, name: "  " })).toBeNull();
	});

	test("without a face or limits, those saves are skipped", async () => {
		const { calls, deps } = fakes();
		await runMint(
			{ ...draft, avatar: null, policy: null },
			newSession(),
			deps,
			() => {},
		);
		expect(calls).not.toContain("avatar");
		expect(calls).not.toContain("policy");
	});
});

describe("waiting for the chain", () => {
	test("a mint the server cannot see yet is asked about again after a pause", async () => {
		let n = 0;
		const { calls, deps } = fakes({
			confirm: async () => {
				calls.push("confirm");
				if (++n < 3) throw new ApiError("NOT_MINED", 409);
				return confirmed;
			},
		});
		expect(await runMint(draft, newSession(), deps, () => {})).toBe("done");
		expect(calls.filter((c) => c === "confirm")).toHaveLength(3);
		expect(calls.filter((c) => c === `sleep:${CONFIRM_WAIT_MS}`)).toHaveLength(
			2,
		);
	});

	test("after the last attempt it fails as retryable, and a retry confirms again without paying twice", async () => {
		let ok = false;
		const { calls, deps } = fakes({
			confirm: async () => {
				calls.push("confirm");
				if (!ok) throw new ApiError("NOT_MINED", 409);
				return confirmed;
			},
		});
		const session = newSession();
		const t = tracker();
		expect(await runMint(draft, session, deps, t.emit)).toBe("failed");
		expect(calls.filter((c) => c === "confirm")).toHaveLength(CONFIRM_ATTEMPTS);
		expect(t.state).toMatchObject({ status: "failed", step: "confirm" });

		ok = true;
		t.emit({ type: "retry" });
		expect(await runMint(draft, session, deps, t.emit)).toBe("done");
		expect(calls.filter((c) => c.startsWith("send:0xaa"))).toHaveLength(1);
		expect(calls.filter((c) => c === "prepare")).toHaveLength(1);
	});
});

describe("when something goes wrong", () => {
	test("cancelling in the wallet is retryable, and the retry asks the wallet again", async () => {
		let reject = true;
		const { calls, deps } = fakes({
			sendTx: async (tx) => {
				calls.push(`send:${tx.data}`);
				if (reject && tx.data === "0xaa")
					throw Object.assign(new Error("denied"), { code: 4001 });
				return `0x${"33".repeat(32)}` as Hex;
			},
		});
		const session = newSession();
		const t = tracker();
		expect(await runMint(draft, session, deps, t.emit)).toBe("failed");
		expect(t.state).toMatchObject({
			status: "failed",
			step: "mint",
			problem: { code: "USER_REJECTED", retryable: true },
		});
		expect(session.mintHash).toBeNull();

		reject = false;
		t.emit({ type: "retry" });
		expect(await runMint(draft, session, deps, t.emit)).toBe("done");
		expect(calls.filter((c) => c === "prepare")).toHaveLength(1);
	});

	test("a mint that reverts on chain cannot be retried, and one that only failed to be read can", async () => {
		const reverted = fakes({ waitMined: async () => "reverted" });
		const t = tracker();
		expect(await runMint(draft, newSession(), reverted.deps, t.emit)).toBe(
			"failed",
		);
		expect(t.state.problem).toMatchObject({
			code: "MINT_FAILED",
			retryable: false,
		});

		let down = true;
		const flaky = fakes({
			waitMined: async () => {
				if (down) throw new TypeError("fetch failed");
				return "success";
			},
		});
		const session = newSession();
		const t2 = tracker();
		expect(await runMint(draft, session, flaky.deps, t2.emit)).toBe("failed");
		expect(t2.state.problem).toMatchObject({
			code: "NETWORK",
			retryable: true,
		});
		down = false;
		t2.emit({ type: "retry" });
		expect(await runMint(draft, session, flaky.deps, t2.emit)).toBe("done");
		expect(flaky.calls.filter((c) => c === "send:0xaa")).toHaveLength(1); // the mint was not sent twice
	});

	test("a failed authorize is retried alone, and a failed face save keeps the limits for later", async () => {
		let authReverts = true;
		let faceFails = true;
		const { calls, deps } = fakes({
			waitMined: async (hash) =>
				hash.startsWith("0x22") && authReverts ? "reverted" : "success",
			saveAvatar: async () => {
				calls.push("avatar");
				if (faceFails) throw new ApiError("INTERNAL", 500);
			},
		});
		const session = newSession();
		const t = tracker();
		expect(await runMint(draft, session, deps, t.emit)).toBe("failed");
		expect(t.state).toMatchObject({
			step: "authorize",
			problem: { code: "AUTHORIZE_FAILED" },
		});

		authReverts = false;
		t.emit({ type: "retry" });
		expect(await runMint(draft, session, deps, t.emit)).toBe("failed");
		expect(t.state).toMatchObject({
			step: "finish",
			problem: { retryable: true },
		});
		expect(calls.filter((c) => c === "confirm")).toHaveLength(1);
		expect(calls.filter((c) => c === "send:0xbb")).toHaveLength(2);

		faceFails = false;
		t.emit({ type: "retry" });
		expect(await runMint(draft, session, deps, t.emit)).toBe("done");
		expect(calls.filter((c) => c === "policy")).toHaveLength(1);
	});
});

describe("walletProblem", () => {
	test("finds a cancel or a lack of funds even when viem has wrapped it", () => {
		const wrapped = (inner: unknown) =>
			Object.assign(new Error("Transaction failed"), { cause: inner });
		expect(
			walletProblem(wrapped(Object.assign(new Error("x"), { code: 4001 })))
				.code,
		).toBe("USER_REJECTED");
		expect(walletProblem(new Error("User rejected the request.")).code).toBe(
			"USER_REJECTED",
		);
		expect(
			walletProblem(
				wrapped(
					Object.assign(new Error("x"), { name: "InsufficientFundsError" }),
				),
			).code,
		).toBe("INSUFFICIENT_FUNDS");
		expect(walletProblem(new Error("insufficient funds for gas")).code).toBe(
			"INSUFFICIENT_FUNDS",
		);
		expect(walletProblem(new Error("boom"))).toMatchObject({
			code: "WALLET_ERROR",
			retryable: true,
		});
		expect(walletProblem(null).retryable).toBe(true);
	});
});
