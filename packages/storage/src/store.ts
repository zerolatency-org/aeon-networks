// packages/storage/src/store.ts
// One interface for blob storage. The server talks to it; tests use the memory store,
// production uses 0G Storage. Blobs are always ciphertext (envelopes), never plain text.
import { MemData } from "@0gfoundation/0g-ts-sdk";

export type Root = `0x${string}`;

export interface BlobStore {
	/** Stores bytes and returns their 0G merkle root. */
	put(bytes: Uint8Array): Promise<{ root: Root; size: number }>;
	/** Returns the bytes for a root. Throws StorageError("NOT_FOUND") if unknown. */
	get(root: Root): Promise<Uint8Array>;
}

export type StorageErrorCode = "NOT_FOUND" | "TIMEOUT" | "EMPTY" | "UPSTREAM";

export class StorageError extends Error {
	constructor(
		readonly code: StorageErrorCode,
		detail?: string,
	) {
		super(detail ? `${code}: ${detail}` : code);
		this.name = "StorageError";
	}
}

/** The 0G merkle root of some bytes, computed locally (no network). */
export async function rootOf(bytes: Uint8Array): Promise<Root> {
	if (bytes.length === 0) throw new StorageError("EMPTY");
	const [tree, err] = await new MemData(bytes).merkleTree();
	if (err || !tree) throw new StorageError("UPSTREAM", String(err));
	return tree.rootHash() as Root;
}

/** In-memory store for tests and local runs. Returns the same root 0G would. */
export function createMemoryStore(): BlobStore & { size(): number } {
	const blobs = new Map<Root, Uint8Array>();
	return {
		async put(bytes) {
			const root = await rootOf(bytes);
			blobs.set(root, bytes.slice());
			return { root, size: bytes.length };
		},
		async get(root) {
			const bytes = blobs.get(root.toLowerCase() as Root);
			if (!bytes) throw new StorageError("NOT_FOUND", root);
			return bytes.slice();
		},
		size: () => blobs.size,
	};
}

/**
 * Bounds every call. An upload that hangs (a stuck 0G node, an RPC that never answers)
 * fails with StorageError("TIMEOUT") instead of holding a job forever.
 */
export function withDeadline(
	store: BlobStore,
	ms: { put: number; get: number },
): BlobStore {
	return {
		put: (bytes) => race(store.put(bytes), ms.put, "put"),
		get: (root) => race(store.get(root), ms.get, "get"),
	};
}

function race<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new StorageError("TIMEOUT", `${what} after ${ms} ms`)),
			ms,
		);
	});
	return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
