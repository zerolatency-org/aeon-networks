import {
	aeonAgentNftAbi,
	aeonEscrowAbi,
	aeonRegistryAbi,
	type Deployment,
} from "@aeon/chain";
import type { Database } from "@aeon/db";
import { agents } from "@aeon/db/schema/aeon";
import {
	chainEvents,
	indexerCursors,
	jobs,
	listings,
	revenueEvents,
} from "@aeon/db/schema/chain";
import { eq, sql } from "drizzle-orm";
import {
	type Address,
	type Hex,
	type PublicClient,
	parseEventLogs,
} from "viem";

export type IndexerOptions = {
	db: Database;
	client: PublicClient;
	deployment: Deployment;
	confirmations: number;
	chunkSize: number;
	cursorName?: string;
};

export type IndexResult = {
	from: bigint;
	to: bigint;
	logs: number;
	applied: number;
	rewound: boolean;
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const ALL_ABI = [...aeonAgentNftAbi, ...aeonRegistryAbi, ...aeonEscrowAbi];
const ZERO: Address = "0x0000000000000000000000000000000000000000";
const lower = (a: string) => a.toLowerCase();
const maxOf = (a: bigint, b: bigint) => (a > b ? a : b);
const minOf = (a: bigint, b: bigint) => (a < b ? a : b);

export async function indexOnce(
	opts: IndexerOptions,
): Promise<IndexResult | null> {
	const { db, client, deployment } = opts;
	const name = opts.cursorName ?? "aeon";
	const start = BigInt(deployment.startBlock);
	const head = await client.getBlockNumber({ cacheTime: 0 });
	const safe = head - BigInt(opts.confirmations);

	const [cursor] = await db
		.select()
		.from(indexerCursors)
		.where(eq(indexerCursors.name, name));
	let last = cursor ? cursor.lastBlock : start - 1n;
	let rewound = false;
	if (cursor?.lastBlockHash) {
		const block = await client
			.getBlock({ blockNumber: last })
			.catch(() => null);
		if (block?.hash !== cursor.lastBlockHash) {
			const back = BigInt(Math.max(opts.confirmations, 1));
			last = maxOf(last - back, start - 1n);
			rewound = true;
		}
	}

	const from = last + 1n;
	if (from > safe) {
		if (rewound) await saveCursor(db, name, last, null);
		return null;
	}
	const to = minOf(from + BigInt(opts.chunkSize) - 1n, safe);
	const contracts = {
		[lower(deployment.nft)]: "nft",
		[lower(deployment.registry)]: "registry",
		[lower(deployment.escrow)]: "escrow",
	} as const;
	const raw = await client.getLogs({
		address: [deployment.nft, deployment.registry, deployment.escrow],
		fromBlock: from,
		toBlock: to,
	});
	const logs = parseEventLogs({ abi: ALL_ABI, logs: raw }).sort((a, b) =>
		a.blockNumber === b.blockNumber
			? a.logIndex - b.logIndex
			: Number(a.blockNumber - b.blockNumber),
	);
	const endBlock = await client.getBlock({ blockNumber: to });
	const times = await blockTimes(
		client,
		logs.filter((l) => contracts[lower(l.address)] === "escrow"),
	);

	let applied = 0;
	await db.transaction(async (tx) => {
		for (const log of logs) {
			const contract = contracts[lower(log.address)];
			if (!contract) continue;
			const fresh = await tx
				.insert(chainEvents)
				.values({
					txHash: log.transactionHash,
					logIndex: log.logIndex,
					blockNumber: log.blockNumber,
					contract,
					eventName: log.eventName,
				})
				.onConflictDoNothing()
				.returning({ txHash: chainEvents.txHash });
			if (fresh.length === 0) continue;
			applied++;
			await apply(tx, log as AnyLog, times.get(log.blockNumber));
		}
		await saveCursor(tx, name, to, endBlock.hash);
	});

	return { from, to, logs: logs.length, applied, rewound };
}

export async function catchUp(opts: IndexerOptions): Promise<number> {
	let passes = 0;
	while ((await indexOnce(opts)) !== null) passes++;
	return passes;
}

export async function runIndexer(
	opts: IndexerOptions & { intervalMs: number; signal?: AbortSignal },
) {
	while (!opts.signal?.aborted) {
		try {
			await catchUp(opts);
		} catch (err) {
			console.error("indexer pass failed", err);
		}
		await Bun.sleep(opts.intervalMs);
	}
}

async function saveCursor(
	db: Database | Tx,
	name: string,
	lastBlock: bigint,
	lastBlockHash: string | null,
) {
	await db
		.insert(indexerCursors)
		.values({ name, lastBlock, lastBlockHash })
		.onConflictDoUpdate({
			target: indexerCursors.name,
			set: { lastBlock, lastBlockHash, updatedAt: sql`now()` },
		});
}

async function blockTimes(
	client: PublicClient,
	logs: { blockNumber: bigint }[],
) {
	const times = new Map<bigint, Date>();
	for (const n of new Set(logs.map((l) => l.blockNumber))) {
		const block = await client.getBlock({ blockNumber: n });
		times.set(n, new Date(Number(block.timestamp) * 1000));
	}
	return times;
}

type AnyLog = {
	eventName: string;
	args: Record<string, unknown>;
	transactionHash: Hex;
	logIndex: number;
	blockNumber: bigint;
};

async function apply(tx: Tx, log: AnyLog, at: Date | undefined) {
	const a = log.args;
	const block = log.blockNumber;
	const jobId = a.jobId as bigint;
	const setJob = (values: Partial<typeof jobs.$inferInsert>) =>
		tx
			.update(jobs)
			.set({ ...values, lastEventBlock: block })
			.where(eq(jobs.chainJobId, jobId));
	const fee = async (amount: bigint) => {
		if (amount === 0n) return;
		const [job] = await tx
			.select({ client: jobs.clientAddress })
			.from(jobs)
			.where(eq(jobs.chainJobId, jobId));
		await tx
			.insert(revenueEvents)
			.values({
				source: "job_fee",
				txHash: log.transactionHash,
				logIndex: log.logIndex,
				amount,
				payerAddress: job?.client ?? ZERO,
				blockNumber: block,
			})
			.onConflictDoNothing();
	};

	switch (log.eventName) {
		case "Minted": {
			await tx
				.insert(agents)
				.values({
					tokenId: a.tokenId as bigint,
					ownerAddress: lower(a.to as string),
					name: `Agent #${a.tokenId}`,
					model: "unset",
					mintedTx: log.transactionHash,
					mintedBlock: block,
				})
				.onConflictDoNothing();
			if ((a.feePaid as bigint) > 0n) {
				await tx
					.insert(revenueEvents)
					.values({
						source: "mint",
						txHash: log.transactionHash,
						logIndex: log.logIndex,
						amount: a.feePaid as bigint,
						payerAddress: lower(a.to as string),
						blockNumber: block,
					})
					.onConflictDoNothing();
			}
			return;
		}
		case "Transfer":
			if (a.from === ZERO) return;
			await tx
				.update(agents)
				.set({
					ownerAddress: lower(a.to as string),
					ownerUserId: null,
					status: "transferred",
				})
				.where(eq(agents.tokenId, a.tokenId as bigint));
			return;
		case "Listed": {
			const row = {
				listedBy: lower(a.owner as string),
				agentWallet: lower(a.agentWallet as string),
				price: a.price as bigint,
				active: true,
				profileHash: a.profileHash as string,
				updatedBlock: block,
			};
			await tx
				.insert(listings)
				.values({ tokenId: a.tokenId as bigint, ...row })
				.onConflictDoUpdate({
					target: listings.tokenId,
					set: { ...row, updatedAt: sql`now()` },
				});
			return;
		}
		case "ListingUpdated":
			await tx
				.update(listings)
				.set({
					price: a.price as bigint,
					profileHash: a.profileHash as string,
					updatedBlock: block,
					updatedAt: sql`now()`,
				})
				.where(eq(listings.tokenId, a.tokenId as bigint));
			return;
		case "Delisted":
			await tx
				.update(listings)
				.set({ active: false, updatedBlock: block, updatedAt: sql`now()` })
				.where(eq(listings.tokenId, a.tokenId as bigint));
			return;
		case "SettlementRecorded": {
			const completed = Number(a.outcome) === 0;
			await tx
				.update(listings)
				.set(
					completed
						? {
								jobsCompleted: sql`${listings.jobsCompleted} + 1`,
								totalSettled: sql`${listings.totalSettled} + ${(a.amount as bigint).toString()}`,
								updatedBlock: block,
							}
						: {
								jobsDisputed: sql`${listings.jobsDisputed} + 1`,
								updatedBlock: block,
							},
				)
				.where(eq(listings.tokenId, a.tokenId as bigint));
			return;
		}
		case "JobCreated":
			await tx
				.insert(jobs)
				.values({
					chainJobId: jobId,
					tokenId: a.tokenId as bigint,
					clientAddress: lower(a.client as string),
					payeeAddress: lower(a.payee as string),
					evaluatorAddress: lower(a.evaluator as string),
					amount: a.amount as bigint,
					state: "funded",
					taskHash: a.taskHash as string,
					expiredAt: new Date(Number(a.expiredAt) * 1000),
					acceptWindowS: Number(a.acceptWindow),
					createTx: log.transactionHash,
					lastEventBlock: block,
				})
				.onConflictDoNothing();
			return;
		case "JobSubmitted":
			await setJob({
				state: "submitted",
				resultHash: a.resultHash as string,
				submittedAt: at,
			});
			return;
		case "JobDisputed":
			await setJob({ state: "disputed", disputedAt: at });
			return;
		case "JobCompleted":
			await setJob({ state: "completed", settledAt: at });
			await fee(a.fee as bigint);
			return;
		case "JobTimedOut":
			await setJob({ state: "timed_out", settledAt: at });
			await fee(a.fee as bigint);
			return;
		case "JobSplit":
			await setJob({ state: "split", settledAt: at });
			await fee(a.fee as bigint);
			return;
		case "JobDeclined":
			await setJob({ state: "declined", settledAt: at });
			return;
		case "JobRefunded":
			await setJob({ state: "refunded", settledAt: at });
			return;
		case "JobForceClosed":
			await setJob({ state: "force_closed", settledAt: at });
			return;
		default:
			return;
	}
}
