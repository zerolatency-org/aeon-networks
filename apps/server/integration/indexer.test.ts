import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { agents } from "@aeon/db/schema/aeon";
import {
	chainEvents,
	indexerCursors,
	jobs,
	listings,
	revenueEvents,
} from "@aeon/db/schema/chain";
import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { parseEther } from "viem";

import {
	catchUp,
	type IndexerOptions,
	indexOnce,
} from "../src/indexer/indexer";
import { setupTestDb } from "../test/db-helpers";
import { account, type Chain, startChain } from "./chain-helpers";

let chain: Chain;
let t: Awaited<ReturnType<typeof setupTestDb>>;
beforeAll(async () => {
	chain = await startChain();
	t = await setupTestDb();
});
afterAll(async () => {
	chain?.stop();
	await t?.close();
});

const opts = (over: Partial<IndexerOptions> = {}): IndexerOptions => ({
	db: t.db,
	client: chain.client,
	deployment: chain.deployment,
	confirmations: 0,
	chunkSize: 5,
	...over,
});
const rows = async (table: PgTable) =>
	(await t.db.select({ n: count() }).from(table))[0]?.n ?? 0;
const cursor = async () =>
	(
		await t.db
			.select()
			.from(indexerCursors)
			.where(eq(indexerCursors.name, "aeon"))
	)[0];

const OWNER = 1;
const BUYER = 2;
const JUDGE = 3;

describe("indexer on anvil", () => {
	test("a mint, a listing and a whole job land in the tables", async () => {
		const tokenId = await chain.aeon.mintAndList(OWNER);
		const jobId = await chain.aeon.hire(tokenId, BUYER, JUDGE);
		await chain.aeon.submit(jobId, OWNER);
		await chain.aeon.complete(jobId, JUDGE);

		const passes = await catchUp(opts());
		expect(passes).toBeGreaterThan(1);

		const [agent] = await t.db
			.select()
			.from(agents)
			.where(eq(agents.tokenId, tokenId));
		expect(agent?.ownerAddress).toBe(account(OWNER).address.toLowerCase());

		const [listing] = await t.db
			.select()
			.from(listings)
			.where(eq(listings.tokenId, tokenId));
		expect(listing?.active).toBe(true);
		expect(listing?.agentWallet).toBe(
			chain.aeon.agentWallet.address.toLowerCase(),
		);
		expect(listing?.jobsCompleted).toBe(1);
		expect(listing?.totalSettled).toBe(parseEther("0.01"));

		const [job] = await t.db
			.select()
			.from(jobs)
			.where(eq(jobs.chainJobId, jobId));
		expect(job?.state).toBe("completed");
		expect(job?.payeeAddress).toBe(account(OWNER).address.toLowerCase());
		expect(job?.submittedAt).toBeInstanceOf(Date);
		expect(job?.settledAt).toBeInstanceOf(Date);

		const [fee] = await t.db.select().from(revenueEvents);
		expect(fee?.source).toBe("job_fee");
		expect(fee?.amount).toBe((parseEther("0.01") * 250n) / 10_000n);
		expect(fee?.payerAddress).toBe(account(BUYER).address.toLowerCase());
	});

	test("replaying a range twice adds nothing", async () => {
		const before = {
			events: await rows(chainEvents),
			fees: await rows(revenueEvents),
			agents: await rows(agents),
		};
		await t.db
			.update(indexerCursors)
			.set({ lastBlock: -1n, lastBlockHash: null })
			.where(eq(indexerCursors.name, "aeon"));

		let applied = 0;
		for (let r = await indexOnce(opts()); r; r = await indexOnce(opts())) {
			applied += r.applied;
		}
		expect(applied).toBe(0);
		expect(await rows(chainEvents)).toBe(before.events);
		expect(await rows(revenueEvents)).toBe(before.fees);
		expect(await rows(agents)).toBe(before.agents);
		const [listing] = await t.db.select().from(listings);
		expect(listing?.jobsCompleted).toBe(1);
	});

	test("the cursor resumes after a restart", async () => {
		const stoppedAt = (await cursor())?.lastBlock ?? 0n;
		const tokenId = await chain.aeon.mintAndList(OWNER);
		const first = await indexOnce(opts({ chunkSize: 100 }));
		expect(first?.from).toBe(stoppedAt + 1n);
		const [agent] = await t.db
			.select()
			.from(agents)
			.where(eq(agents.tokenId, tokenId));
		expect(agent).toBeDefined();
	});

	test("a reorg within the confirmation depth is never indexed", async () => {
		const depth = opts({ confirmations: 3 });
		await catchUp(depth);
		const agentsBefore = await rows(agents);

		const snapshot = await chain.testClient.snapshot();
		await chain.aeon.mintAndList(OWNER);
		await catchUp(depth);
		expect(await rows(agents)).toBe(agentsBefore);

		await chain.testClient.revert({ id: snapshot });
		await chain.testClient.increaseTime({ seconds: 60 });
		await chain.testClient.mine({ blocks: 6 });
		await catchUp(depth);
		expect(await rows(agents)).toBe(agentsBefore);
		const head = await chain.client.getBlockNumber({ cacheTime: 0 });
		expect((await cursor())?.lastBlock).toBe(head - 3n);
	});

	test("a reorg deeper than the depth rewinds the cursor and carries on", async () => {
		await catchUp(opts());
		const snapshot = await chain.testClient.snapshot();
		await chain.testClient.mine({ blocks: 2 });
		await catchUp(opts());
		const indexedTip = await cursor();

		await chain.testClient.revert({ id: snapshot });
		await chain.testClient.increaseTime({ seconds: 60 });
		await chain.testClient.mine({ blocks: 3 });

		const r = await indexOnce(opts());
		expect(r?.rewound).toBe(true);
		await catchUp(opts());
		const now = await cursor();
		const block = await chain.client.getBlock({
			blockNumber: now?.lastBlock ?? 0n,
		});
		expect(now?.lastBlockHash).toBe(block.hash);
		expect(now?.lastBlockHash).not.toBe(indexedTip?.lastBlockHash);
	});
});
