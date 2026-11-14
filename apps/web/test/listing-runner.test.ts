// apps/web/test/listing-runner.test.ts
import { describe, expect, test } from "bun:test";
import type { Hex } from "@/lib/agents-parse";
import {
	type ListingDeps,
	type ListingDraft,
	newListingSession,
	runListing,
} from "@/lib/listing-runner";
import { ApiError } from "@/lib/siwe-api";

const draft: ListingDraft = {
	agentId: "5c1e0a52-0000-4000-8000-000000000001",
	action: "list",
	priceWei: "1000000000000000",
	tags: ["research", "data"],
};

const prepared = {
	profileHash:
		"0x1111111111111111111111111111111111111111111111111111111111111111" as Hex,
	tx: {
		chainId: 16602,
		to: "0x2222222222222222222222222222222222222222" as Hex,
		value: "0",
		data: "0xaabb" as Hex,
	},
};

const confirmed = {
	listings: [
		{
			tokenId: "7",
			listing: {
				tokenId: "7",
				name: "Scout",
				description: "Does research",
				tags: ["research", "data"],
				price: "1000000000000000",
				owner: "0xowner",
				agentWallet: "0xagent",
				jobsCompleted: 0,
				jobsDisputed: 0,
				totalSettled: "0",
				profileHash: "0x1111",
			},
		},
	],
};

const HASH =
	"0x9999999999999999999999999999999999999999999999999999999999999999" as Hex;

function fakes(overrides: Partial<ListingDeps> = {}) {
	const calls: string[] = [];
	const deps: ListingDeps = {
		prepare: async () => {
			calls.push("prepare");
			return prepared;
		},
		sendTx: async (tx) => {
			calls.push(`send:${tx.data}`);
			return HASH;
		},
		waitMined: async () => {
			calls.push("mined");
			return "success";
		},
		confirm: async () => {
			calls.push("confirm");
			return confirmed;
		},
		sleep: async () => {
			calls.push("sleep");
		},
		...overrides,
	};
	return { deps, calls };
}

describe("listing runner - pure flow", () => {
	test("a clean listing runs prepare -> sendTx -> waitMined -> confirm", async () => {
		const { deps, calls } = fakes();
		const session = newListingSession();
		const events: string[] = [];

		const result = await runListing(draft, session, deps, (e) =>
			events.push(e.step),
		);

		expect(result.ok).toBe(true);
		expect(calls).toEqual(["prepare", "send:0xaabb", "mined", "confirm"]);
		expect(events).toEqual(["prepare", "send", "mining", "confirm", "done"]);
		expect(session.confirmed).toEqual(confirmed);
	});

	test("resumes without calling prepare or sendTx again if tx was already mined", async () => {
		const { deps, calls } = fakes();
		const session = newListingSession();
		session.prepared = prepared;
		session.txHash = HASH;
		session.txMined = true;

		const result = await runListing(draft, session, deps, () => {});
		expect(result.ok).toBe(true);
		expect(calls).toEqual(["confirm"]);
	});

	test("retries confirm if server returns NOT_MINED (409)", async () => {
		let attempts = 0;
		const { deps, calls } = fakes({
			confirm: async () => {
				calls.push("confirm");
				attempts++;
				if (attempts < 3) {
					throw new ApiError("NOT_MINED", 409);
				}
				return confirmed;
			},
		});
		const session = newListingSession();
		const result = await runListing(draft, session, deps, () => {});

		expect(result.ok).toBe(true);
		expect(attempts).toBe(3);
		expect(calls.filter((c) => c === "confirm").length).toBe(3);
		expect(calls.filter((c) => c === "sleep").length).toBe(2);
	});

	test("wallet rejection is retryable and does not submit tx", async () => {
		const { deps } = fakes({
			sendTx: async () => {
				const err = new Error("User rejected the request");
				(err as unknown as { code: number }).code = 4001;
				throw err;
			},
		});
		const session = newListingSession();
		const result = await runListing(draft, session, deps, () => {});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.problem.code).toBe("USER_REJECTED");
			expect(result.problem.retryable).toBe(true);
		}
	});

	test("reverted tx fails with unretryable error", async () => {
		const { deps } = fakes({
			waitMined: async () => "reverted",
		});
		const session = newListingSession();
		const result = await runListing(draft, session, deps, () => {});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.problem.code).toBe("TX_REVERTED");
			expect(result.problem.retryable).toBe(false);
		}
	});
});
