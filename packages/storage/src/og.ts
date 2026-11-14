// packages/storage/src/og.ts
// 0G Storage through the official SDK. The SDK needs an ethers signer, which is why
// ethers lives in this package only. The signer pays the storage fee for each upload.
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";

import { type BlobStore, type Root, StorageError } from "./store";

export type OgStoreConfig = {
	/** e.g. https://indexer-storage-testnet-turbo.0g.ai */
	indexerUrl: string;
	/** e.g. https://evmrpc-testnet.0g.ai */
	rpcUrl: string;
	/** Funded key that pays for uploads. Server-only. */
	privateKey: string;
};

export function createOgStore(config: OgStoreConfig): BlobStore {
	const indexer = new Indexer(config.indexerUrl);
	const signer = new Wallet(
		config.privateKey,
		new JsonRpcProvider(config.rpcUrl),
	);

	return {
		async put(bytes) {
			if (bytes.length === 0) throw new StorageError("EMPTY");
			const [result, err] = await indexer.upload(
				new MemData(bytes),
				config.rpcUrl,
				signer,
			);
			if (err || !result || !("rootHash" in result)) {
				throw new StorageError("UPSTREAM", String(err ?? "no root returned"));
			}
			return { root: result.rootHash as Root, size: bytes.length };
		},
		async get(root) {
			const [blob, err] = await indexer.downloadToBlob(root, { proof: true });
			if (err) {
				const msg = String(err);
				throw new StorageError(
					/not found|no locations|no available/i.test(msg)
						? "NOT_FOUND"
						: "UPSTREAM",
					msg,
				);
			}
			return new Uint8Array(await blob.arrayBuffer());
		},
	};
}
