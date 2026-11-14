// packages/storage/test/suite.ts
// The behaviour every BlobStore must have. Runs against the memory store always
// and against 0G when LIVE=1.
import { describe, expect, test } from "bun:test";

import { type BlobStore, rootOf, StorageError } from "../src/index";

export function blobStoreSuite(name: string, make: () => BlobStore) {
	describe(`BlobStore: ${name}`, () => {
		const store = make();
		const bytes = (s: string) => new TextEncoder().encode(s);

		test("put then get returns the same bytes and the 0G root", async () => {
			const data = bytes(`envelope ${crypto.randomUUID()}`);
			const { root, size } = await store.put(data);
			expect(root).toBe(await rootOf(data));
			expect(size).toBe(data.length);
			expect(await store.get(root)).toEqual(data);
		});

		test("a 300 KB blob survives the round trip", async () => {
			const data = crypto.getRandomValues(new Uint8Array(300_000));
			const { root } = await store.put(data);
			expect(await store.get(root)).toEqual(data);
		});

		test("empty bytes are refused", async () => {
			await expect(store.put(new Uint8Array())).rejects.toThrow(StorageError);
		});

		test("an unknown root is NOT_FOUND", async () => {
			const root = await rootOf(bytes(`never stored ${crypto.randomUUID()}`));
			const err = await store.get(root).catch((e) => e);
			expect(err).toBeInstanceOf(StorageError);
			expect((err as StorageError).code).toBe("NOT_FOUND");
		});
	});
}
