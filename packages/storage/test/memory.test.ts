// packages/storage/test/memory.test.ts
import { describe, expect, test } from "bun:test";

import {
	type BlobStore,
	createMemoryStore,
	rootOf,
	StorageError,
	withDeadline,
} from "../src/index";
import { blobStoreSuite } from "./suite";

blobStoreSuite("memory", createMemoryStore);
blobStoreSuite("memory with deadline", () =>
	withDeadline(createMemoryStore(), { put: 1_000, get: 1_000 }),
);

describe("roots", () => {
	test("match the 0G merkle root for known bytes", async () => {
		expect(await rootOf(new TextEncoder().encode("hello aeon"))).toBe(
			"0x6104412cafbf1388a843e87b6acf807b6aa25c51e3b62142639e5471179929db",
		);
	});
});

describe("deadline", () => {
	const hanging: BlobStore = {
		put: () => new Promise(() => {}),
		get: () => new Promise(() => {}),
	};

	test("a hanging upload fails with TIMEOUT after the deadline", async () => {
		const store = withDeadline(hanging, { put: 50, get: 50 });
		const started = Date.now();
		const err = await store.put(new Uint8Array([1])).catch((e) => e);
		expect((err as StorageError).code).toBe("TIMEOUT");
		expect(Date.now() - started).toBeLessThan(1_000);
	});

	test("a hanging download fails with TIMEOUT too", async () => {
		const store = withDeadline(hanging, { put: 50, get: 50 });
		const err = await store.get("0x01").catch((e) => e);
		expect(err).toBeInstanceOf(StorageError);
		expect((err as StorageError).code).toBe("TIMEOUT");
	});
});
