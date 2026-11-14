// apps/web/test/hire-runner.test.ts
import { describe, expect, test } from "bun:test";
import type { Hex } from "@/lib/agents-parse";
import {
	type HireDeps,
	type HireDraft,
	newHireSession,
	runHire,
} from "@/lib/hire-runner";
import type { JobView, PreparedJob } from "@/lib/jobs-api";
import { ApiError } from "@/lib/siwe-api";

const draft: HireDraft = {
	tokenId: "7",
	taskBrief: "Extract company revenue from table in document.",
	amountWei: "10000000000000000", // 0.01 0G
	evaluatorAddress: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	taskHash:
		"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111" as Hex,
	envelope: { v: 1, mock: true },
};

const prepared: PreparedJob = {
	chainId: 16602,
	escrow: "0xescrow4444444444444444444444444444444444",
	tokenId: "7",
	client: "0xclient1111111111111111111111111111111111",
	payee: "0xpayee2222222222222222222222222222222222",
	evaluator: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	provider: "0xprov3333333333333333333333333333333333",
	amount: "10000000000000000",
	expiredAt: "1794500000",
	acceptWindowS: 3600,
	tx: {
		chainId: 16602,
		to: "0xescrow4444444444444444444444444444444444" as Hex,
		value: "10000000000000000",
		data: "0xcreateJobData" as Hex,
	},
};

const mockJob: JobView = {
	jobId: "42",
	tokenId: "7",
	state: "funded",
	client: "0xclient1111111111111111111111111111111111",
	payee: "0xpayee2222222222222222222222222222222222",
	evaluator: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	amount: "10000000000000000",
	taskHash:
		"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
	resultHash: null,
	expiredAt: "2026-11-15T12:00:00.000Z",
	acceptWindowS: 3600,
	submittedAt: null,
	settledAt: null,
	roles: ["client"],
};

const TX_HASH =
	"0x9999999999999999999999999999999999999999999999999999999999999999" as Hex;

function fakes(overrides: Partial<HireDeps> = {}) {
	const calls: string[] = [];
	const deps: HireDeps = {
		prepare: async () => {
			calls.push("prepare");
			return prepared;
		},
		sendEscrowTx: async (tx) => {
			calls.push(`send:${tx.data}`);
			return TX_HASH;
		},
		waitMined: async () => {
			calls.push("mined");
			return "success";
		},
		confirm: async () => {
			calls.push("confirm");
			return { job: mockJob, providerQueued: true };
		},
		deliverTask: async () => {
			calls.push("deliver");
			return { jobId: "42", size: 50, expiresAt: "2026-11-20" };
		},
		sleep: async () => {
			calls.push("sleep");
		},
		...overrides,
	};
	return { deps, calls };
}

describe("Hire runner - resumable escrow flow", () => {
	test("runs complete clean flow: prepare -> sendEscrowTx -> waitMined -> confirm -> deliverTask", async () => {
		const { deps, calls } = fakes();
		const session = newHireSession();
		const events: string[] = [];

		const result = await runHire(draft, session, deps, (e) =>
			events.push(e.step),
		);

		expect(result.ok).toBe(true);
		expect(calls).toEqual([
			"prepare",
			"send:0xcreateJobData",
			"mined",
			"confirm",
			"deliver",
		]);
		expect(events).toEqual([
			"prepare",
			"send",
			"mining",
			"confirm",
			"deliver",
			"done",
		]);
		expect(session.confirmedJob?.jobId).toBe("42");
		expect(session.taskDelivered).toBe(true);
	});

	test("never pays twice: resumes after mining without re-sending transaction", async () => {
		const { deps, calls } = fakes();
		const session = newHireSession();
		session.prepared = prepared;
		session.escrowHash = TX_HASH;
		session.escrowMined = true;

		const result = await runHire(draft, session, deps, () => {});
		expect(result.ok).toBe(true);
		expect(calls).toEqual(["confirm", "deliver"]);
	});

	test("resumes after confirmation to only deliver task if delivery had failed", async () => {
		const { deps, calls } = fakes();
		const session = newHireSession();
		session.prepared = prepared;
		session.escrowHash = TX_HASH;
		session.escrowMined = true;
		session.confirmedJob = mockJob;

		const result = await runHire(draft, session, deps, () => {});
		expect(result.ok).toBe(true);
		expect(calls).toEqual(["deliver"]);
	});

	test("retries confirm on NOT_MINED (409) with polling backoff", async () => {
		let attempts = 0;
		const { deps, calls } = fakes({
			confirm: async () => {
				calls.push("confirm");
				attempts++;
				if (attempts < 3) {
					throw new ApiError("NOT_MINED", 409);
				}
				return { job: mockJob, providerQueued: true };
			},
		});
		const session = newHireSession();
		const result = await runHire(draft, session, deps, () => {});

		expect(result.ok).toBe(true);
		expect(attempts).toBe(3);
		expect(calls.filter((c) => c === "confirm").length).toBe(3);
		expect(calls.filter((c) => c === "sleep").length).toBe(2);
	});

	test("wallet rejection produces retryable USER_REJECTED problem", async () => {
		const { deps } = fakes({
			sendEscrowTx: async () => {
				const err = new Error("User denied transaction signature");
				(err as unknown as { code: number }).code = 4001;
				throw err;
			},
		});
		const session = newHireSession();
		const result = await runHire(draft, session, deps, () => {});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.problem.code).toBe("USER_REJECTED");
			expect(result.problem.retryable).toBe(true);
		}
	});

	test("reverted transaction fails unretryably", async () => {
		const { deps } = fakes({
			waitMined: async () => "reverted",
		});
		const session = newHireSession();
		const result = await runHire(draft, session, deps, () => {});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.problem.code).toBe("ESCROW_TX_REVERTED");
			expect(result.problem.retryable).toBe(false);
		}
	});
});
