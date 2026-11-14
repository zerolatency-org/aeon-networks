import { chainFor, loadDeployment } from "@aeon/chain";
import { createDb } from "@aeon/db";
import { createPublicClient, http } from "viem";

import { ENV } from "./env.server";
import { runIndexer } from "./indexer/indexer";

const deployment = loadDeployment(ENV.DEPLOYMENT_FILE);
const client = createPublicClient({
	chain: chainFor(deployment.chainId, ENV.OG_RPC_URL),
	transport: http(ENV.OG_RPC_URL),
});

const rpcChain = await client.getChainId();
if (rpcChain !== deployment.chainId) {
	throw new Error(
		`OG_RPC_URL is chain ${rpcChain} but ${ENV.DEPLOYMENT_FILE} is chain ${deployment.chainId}`,
	);
}

const stop = new AbortController();
process.on("SIGINT", () => stop.abort());
process.on("SIGTERM", () => stop.abort());

console.log(
	`indexer: chain ${deployment.chainId} from block ${deployment.startBlock}, ` +
		`${ENV.INDEXER_CONFIRMATIONS} confirmations, ${ENV.INDEXER_CHUNK_SIZE} blocks per call`,
);
await runIndexer({
	db: createDb(ENV),
	client,
	deployment,
	confirmations: ENV.INDEXER_CONFIRMATIONS,
	chunkSize: ENV.INDEXER_CHUNK_SIZE,
	intervalMs: 2_000,
	signal: stop.signal,
});
process.exit(0);
