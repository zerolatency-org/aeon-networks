// apps/server/src/worker.ts
// Background process. Always: the indexer keeps Postgres in step with the chain.
// With agent services configured (MASTER_KEY, ROUTER_API_KEY, deployment): the provider
// works hired jobs. With KEEPER_PRIVATE_KEY: the keeper settles jobs nobody acts on.
// Run: cd apps/server && bun run worker
import { createMemoryStore, createOgStore, withDeadline } from "@aeon/storage";
import { privateKeyToAccount } from "viem/accounts";

import { ENV } from "./env.server";
import { runIndexer } from "./indexer/indexer";
import { runKeeperOnce } from "./keeper";
import { runProviderOnce } from "./provider";
import { aeon, db } from "./services";

if (!aeon) {
	throw new Error(
		"the worker needs MASTER_KEY, ROUTER_API_KEY and DEPLOYMENT_FILE (see .env.schema)",
	);
}
const { client, deployment } = aeon;
const rpcChain = await client.getChainId();
if (rpcChain !== deployment.chainId) {
	throw new Error(
		`OG_RPC_URL is chain ${rpcChain} but ${ENV.DEPLOYMENT_FILE} is chain ${deployment.chainId}`,
	);
}

const stop = new AbortController();
process.on("SIGINT", () => stop.abort());
process.on("SIGTERM", () => stop.abort());

/** Runs `pass` every `intervalMs` until stopped. `pass` returns true while there is more to do. */
async function loop(
	name: string,
	intervalMs: number,
	pass: () => Promise<boolean>,
) {
	while (!stop.signal.aborted) {
		try {
			while (!stop.signal.aborted && (await pass())) {}
		} catch (err) {
			console.error(`${name} pass failed: ${(err as Error).name}`);
		}
		await Bun.sleep(intervalMs);
	}
}

function resultStore() {
	if (!ENV.STORAGE_PRIVATE_KEY) {
		console.warn(
			"STORAGE_PRIVATE_KEY not set: results over the mailbox cap stay in memory",
		);
		return createMemoryStore();
	}
	return withDeadline(
		createOgStore({
			indexerUrl: ENV.OG_INDEXER_URL,
			rpcUrl: ENV.OG_RPC_URL,
			privateKey: ENV.STORAGE_PRIVATE_KEY,
		}),
		{ put: 120_000, get: 60_000 },
	);
}
const store = resultStore();
const services = aeon;

const loops = [
	runIndexer({
		db,
		client,
		deployment,
		confirmations: ENV.INDEXER_CONFIRMATIONS,
		chunkSize: ENV.INDEXER_CHUNK_SIZE,
		intervalMs: 2_000,
		signal: stop.signal,
	}),
	loop("provider", 2_000, async () => {
		const outcome = await runProviderOnce({
			db,
			aeon: services,
			store,
			workerId: `worker-${process.pid}`,
		});
		if (outcome)
			console.log(`provider: job ${outcome.jobId} ${outcome.status}`);
		return outcome !== null;
	}),
];
if (ENV.KEEPER_PRIVATE_KEY) {
	const keeper = privateKeyToAccount(ENV.KEEPER_PRIVATE_KEY as `0x${string}`);
	loops.push(
		loop("keeper", 30_000, async () => {
			for (const a of await runKeeperOnce({ db, client, deployment, keeper })) {
				console.log(`keeper: ${a.action} job ${a.jobId} (${a.txHash})`);
			}
			return false;
		}),
	);
} else {
	console.warn("KEEPER_PRIVATE_KEY not set: the keeper loop is off");
}

console.log(
	`worker: chain ${deployment.chainId}, indexer + provider${ENV.KEEPER_PRIVATE_KEY ? " + keeper" : ""}`,
);
await Promise.all(loops);
process.exit(0);
