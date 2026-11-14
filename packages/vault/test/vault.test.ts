// packages/vault/test/vault.test.ts
// The archive with a memory store and an in-memory "chain" anchor.
import { describe, expect, test } from "bun:test";
import { createAgentWallet, DecryptError } from "@aeon/crypto";
import { createMemoryStore } from "@aeon/storage";
import type { Hex } from "viem";

import { createVault, ZERO_ROOT } from "../src/index";

const text = (b: Uint8Array) => new TextDecoder().decode(b);
const bytes = (s: string) => new TextEncoder().encode(s);

/** A store plus an anchor slot, standing in for 0G Storage and the agent token. */
function world() {
	const store = createMemoryStore();
	let anchored: Hex = ZERO_ROOT;
	const anchors: Hex[] = [];
	return {
		store,
		anchors,
		readAnchor: async () => anchored,
		anchor: async (root: Hex) => {
			anchored = root;
			anchors.push(root);
			return `0x${"ab".repeat(32)}` as Hex;
		},
	};
}

describe("vault", () => {
	test("an archive restores on an empty vault from the anchor and the store alone", async () => {
		const w = world();
		const key = createAgentWallet().privateKey;
		const vault = createVault({ ...w, privateKey: key, tokenId: 7n });
		await vault.archive("1", bytes("first result"));
		await vault.archive("2", bytes("second result"));
		expect(w.anchors).toHaveLength(2);

		// a fresh vault: nothing in memory, only the same key, store and anchor
		const fresh = createVault({ ...w, privateKey: key, tokenId: 7n });
		const restored = await fresh.restore();
		expect(restored.map((r) => [r.jobId, text(r.plaintext)])).toEqual([
			["1", "first result"],
			["2", "second result"],
		]);
	});

	test("deleting drops the entry's key and re-anchors", async () => {
		const w = world();
		const key = createAgentWallet().privateKey;
		const vault = createVault({ ...w, privateKey: key, tokenId: 7n });
		await vault.archive("1", bytes("keep"));
		await vault.archive("2", bytes("forget"));
		const gone = (await vault.load()).entries.find((e) => e.jobId === "2");

		expect(await vault.remove("2")).not.toBeNull();
		expect(w.anchors).toHaveLength(3);
		const manifest = await vault.load();
		expect(manifest.entries.map((e) => e.jobId)).toEqual(["1"]);
		expect(JSON.stringify(manifest)).not.toContain(gone?.key ?? "x");
		expect((await vault.restore()).map((r) => text(r.plaintext))).toEqual([
			"keep",
		]);
		// the blob is still on the store, but nothing left can open it
		expect(await w.store.get(gone?.rootHash ?? "0x")).toBeDefined();
		expect(await vault.remove("2")).toBeNull();
	});

	test("another key cannot open the manifest", async () => {
		const w = world();
		const vault = createVault({
			...w,
			privateKey: createAgentWallet().privateKey,
			tokenId: 7n,
		});
		await vault.archive("1", bytes("secret"));
		const stranger = createVault({
			...w,
			privateKey: createAgentWallet().privateKey,
			tokenId: 7n,
		});
		await expect(stranger.restore()).rejects.toThrow(DecryptError);
	});
});
