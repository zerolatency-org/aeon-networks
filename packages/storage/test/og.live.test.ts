// packages/storage/test/og.live.test.ts
// Real 0G Storage on Galileo. Skipped unless LIVE=1. Costs a little testnet 0G per run.
//   LIVE=1 STORAGE_PRIVATE_KEY=0x... bun run test:live
import { describe, test } from "bun:test";

import { createOgStore, withDeadline } from "../src/index";
import { blobStoreSuite } from "./suite";

const live = process.env.LIVE === "1";

if (live) {
	const privateKey = process.env.STORAGE_PRIVATE_KEY;
	if (!privateKey)
		throw new Error("set STORAGE_PRIVATE_KEY (a funded throwaway key)");
	blobStoreSuite("0G Galileo", () =>
		withDeadline(
			createOgStore({
				indexerUrl:
					process.env.OG_INDEXER_URL ??
					"https://indexer-storage-testnet-turbo.0g.ai",
				rpcUrl: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
				privateKey,
			}),
			{ put: 120_000, get: 60_000 },
		),
	);
} else {
	describe("BlobStore: 0G Galileo", () => {
		test.skip("set LIVE=1 to run against Galileo", () => {});
	});
}
