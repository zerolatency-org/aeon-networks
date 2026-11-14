// apps/server/src/worker.ts
// Background process. The indexer keeps Postgres in step with the chain; the provider
// works hired jobs; the evaluator verifies, pays and archives; the buyer acts on owners'
// instructions and approved hires; the keeper settles silent jobs; the sweeper empties
// the mailbox. Run: cd apps/server && bun run worker
import { privateKeyToAccount } from "viem/accounts";

import { runBuyerOnce } from "./buyer";
import { ENV } from "./env.server";
import { runEvaluatorOnce } from "./evaluator";
import { runApprovedHiresOnce } from "./hiring";
import { runIndexer } from "./indexer/indexer";
import { runKeeperOnce } from "./keeper";
import { runProviderOnce } from "./provider";
import { aeon, db, verifierKey } from "./services";
import { runSweeperOnce } from "./sweeper";

if (!aeon?.store) {
	throw new Error(
		"the worker needs MASTER_KEY, ROUTER_API_KEY and DEPLOYMENT_FILE (see .env.schema)",
	);
}
const services = aeon;
const store = aeon.store;
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
const workerId = `worker-${process.pid}`;

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
		const out = await runProviderOnce({ db, aeon: services, store, workerId });
		if (out) console.log(`provider: job ${out.jobId} ${out.status}`);
		return out !== null;
	}),
	loop("evaluator", 2_000, async () => {
		const out = await runEvaluatorOnce({
			db,
			aeon: services,
			store,
			workerId,
			verifierKey,
		});
		if (out) console.log(`evaluator: job ${out.jobId} ${out.status}`);
		return out !== null;
	}),
	loop("buyer", 2_000, async () => {
		const task = await runBuyerOnce({ db, aeon: services });
		if (task) console.log(`buyer: task ${task.taskId} ${task.status}`);
		const hire = await runApprovedHiresOnce(db, services);
		if (hire) console.log(`buyer: approved hire ${hire.approvalId} done`);
		return task !== null || hire !== null;
	}),
	loop("sweeper", 5 * 60_000, async () => {
		const swept = await runSweeperOnce(db);
		if (swept.deliveries || swept.approvals)
			console.log(
				`sweeper: ${swept.deliveries} deliveries, ${swept.approvals} approvals`,
			);
		return false;
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
	`worker: chain ${deployment.chainId}, indexer + provider + evaluator + buyer + sweeper${ENV.KEEPER_PRIVATE_KEY ? " + keeper" : ""}${verifierKey ? " (Aeon Verifier on)" : ""}`,
);
await Promise.all(loops);
process.exit(0);
