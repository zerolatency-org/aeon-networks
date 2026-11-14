// apps/web/test/mint-flow.test.ts
import { describe, expect, test } from "bun:test";

import type { Problem } from "@/lib/agents-parse";
import {
	agentExists,
	initialProgress,
	MINT_STEPS,
	type MintEvent,
	type MintProgress,
	mintReducer,
	trackerRows,
} from "@/lib/mint-flow";

const run = (events: MintEvent[], from: MintProgress = initialProgress) =>
	events.reduce(mintReducer, from);
const retryable: Problem = {
	code: "NOT_MINED",
	message: "Not confirmed yet.",
	retryable: true,
};
const final: Problem = {
	code: "MINT_MISMATCH",
	message: "Wrong draft.",
	retryable: false,
};

describe("moving through the mint", () => {
	test("start begins at prepare, and each advance moves one step until done", () => {
		let s = run([{ type: "start" }]);
		expect(s).toMatchObject({ status: "running", step: "prepare" });
		const seen: (string | null)[] = [];
		for (let i = 0; i < MINT_STEPS.length; i++) {
			s = mintReducer(s, { type: "advance" });
			seen.push(s.step);
		}
		expect(seen).toEqual(["mint", "confirm", "authorize", "finish", null]);
		expect(s.status).toBe("done");
	});

	test("nothing happens before start, and nothing changes once done", () => {
		expect(run([{ type: "advance" }])).toBe(initialProgress);
		const done = run([
			{ type: "start" },
			...MINT_STEPS.map((): MintEvent => ({ type: "advance" })),
		]);
		expect(done.status).toBe("done");
		expect(mintReducer(done, { type: "fail", problem: final })).toBe(done);
		expect(mintReducer(done, { type: "start" })).toBe(done);
	});

	test("the fee from prepare is kept for the rest of the mint", () => {
		const s = run([
			{ type: "start" },
			{ type: "advance", feeWei: "100000000000000000" },
			{ type: "advance" },
		]);
		expect(s.feeWei).toBe("100000000000000000");
		expect(s.step).toBe("confirm");
	});
});

describe("failing and retrying", () => {
	test("a failure stays on its step, and only a retryable one can retry", () => {
		const failed = run([
			{ type: "start" },
			{ type: "advance", feeWei: "100000000000000000" },
			{ type: "advance" },
			{ type: "fail", problem: retryable },
		]);
		expect(failed).toMatchObject({
			status: "failed",
			step: "confirm",
			problem: retryable,
		});
		expect(mintReducer(failed, { type: "retry" })).toMatchObject({
			status: "running",
			step: "confirm",
			problem: null,
		});

		const stuck = run([{ type: "start" }, { type: "fail", problem: final }]);
		expect(mintReducer(stuck, { type: "retry" })).toBe(stuck);
		expect(mintReducer(stuck, { type: "reset" })).toBe(initialProgress);
	});

	test("the agent counts as existing only after the chain confirmed it", () => {
		const at = (n: number): MintProgress =>
			run([
				{ type: "start" },
				...Array.from({ length: n }, (): MintEvent => ({ type: "advance" })),
			]);
		expect(agentExists(at(0))).toBe(false); // prepare
		expect(agentExists(at(2))).toBe(false); // waiting for the chain
		expect(agentExists(at(3))).toBe(true); // authorize
		expect(agentExists(at(5))).toBe(true); // done
	});
});

describe("tracker rows", () => {
	test("idle is all pending, running marks done, active and pending, and done is all done", () => {
		expect(trackerRows(initialProgress).map((r) => r.state)).toEqual(
			Array(5).fill("pending"),
		);
		const mid = run([
			{ type: "start" },
			{ type: "advance" },
			{ type: "advance" },
		]);
		expect(trackerRows(mid).map((r) => r.state)).toEqual([
			"done",
			"done",
			"active",
			"pending",
			"pending",
		]);
		const done = run([
			{ type: "start" },
			...MINT_STEPS.map((): MintEvent => ({ type: "advance" })),
		]);
		expect(trackerRows(done).every((r) => r.state === "done")).toBe(true);
	});

	test("a failed step shows its message, and the mint row shows the fee once known", () => {
		const failed = run([
			{ type: "start" },
			{ type: "advance", feeWei: "100000000000000000" },
			{ type: "fail", problem: retryable },
		]);
		expect(trackerRows(failed)[1]).toMatchObject({
			state: "failed",
			note: "Not confirmed yet.",
		});
		const ok = run([
			{ type: "start" },
			{ type: "advance", feeWei: "100000000000000000" },
		]);
		expect(trackerRows(ok)[1]).toMatchObject({
			state: "active",
			note: "Fee: 0.1 0G plus gas",
		});
	});
});
