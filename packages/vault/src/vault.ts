// packages/vault/src/vault.ts
// An agent's archive on 0G Storage. Each accepted result is re-encrypted under its own
// random entry key and uploaded; a manifest lists every entry with its key, is sealed
// under a key derived from the vault key, uploaded too, and its root is anchored on the
// agent's token. With only the vault key and the chain, the whole archive comes back.
// Deleting an entry drops its key from the manifest and re-anchors: the blob stays on 0G
// but nobody can read it any more.
import { aesDecrypt, aesEncrypt, randomBytes } from "@aeon/crypto";
import {
	concat,
	fromB64url,
	fromUtf8,
	toB64url,
	utf8,
} from "@aeon/crypto/encoding";
import type { BlobStore, Root } from "@aeon/storage";
import { type Hex, hexToBytes } from "viem";

export const ZERO_ROOT =
	"0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type ManifestEntry = {
	jobId: string;
	rootHash: Root;
	/** the entry key, base64url; whoever reads the manifest can read the entry */
	key: string;
	size: number;
	createdAt: string;
};

export type Manifest = { v: 1; tokenId: string; entries: ManifestEntry[] };

export type VaultDeps = {
	store: BlobStore;
	/** the vault key: an agent wallet key, or a user's derived vault key */
	privateKey: Hex;
	tokenId: bigint;
	/** reads the anchored manifest root (AeonAgentNFT.manifestOf) */
	readAnchor: () => Promise<Hex>;
	/** anchors a new manifest root (AeonAgentNFT.anchorManifest); returns the tx hash */
	anchor: (root: Hex) => Promise<Hex>;
};

const ab = (b: Uint8Array) => new Uint8Array(b).buffer as ArrayBuffer;

/** HKDF(vault key, "aeon-manifest-v1", tokenId): one manifest key per agent token. */
export async function manifestKey(
	privateKey: Hex,
	tokenId: bigint,
): Promise<Uint8Array> {
	const ikm = await crypto.subtle.importKey(
		"raw",
		ab(hexToBytes(privateKey)),
		"HKDF",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: ab(utf8("aeon")),
			info: ab(utf8(`aeon-manifest-v1|${tokenId}`)),
		},
		ikm,
		256,
	);
	return new Uint8Array(bits);
}

/** iv (12) | ciphertext+tag, bound to `context`. */
async function seal(key: Uint8Array, plaintext: Uint8Array, context: string) {
	const { iv, ct } = await aesEncrypt(key, plaintext, utf8(context));
	return concat(iv, ct);
}
const open = (key: Uint8Array, sealed: Uint8Array, context: string) =>
	aesDecrypt(key, sealed.slice(0, 12), sealed.slice(12), utf8(context));

export function createVault(deps: VaultDeps) {
	const { store, tokenId } = deps;
	const manifestContext = `aeon-manifest|${tokenId}`;
	const entryContext = (jobId: string) => `aeon-archive|${tokenId}|${jobId}`;

	async function load(): Promise<Manifest> {
		const root = await deps.readAnchor();
		if (root === ZERO_ROOT)
			return { v: 1, tokenId: tokenId.toString(), entries: [] };
		const key = await manifestKey(deps.privateKey, tokenId);
		const bytes = await store.get(root as Root);
		return JSON.parse(
			fromUtf8(await open(key, bytes, manifestContext)),
		) as Manifest;
	}

	async function save(manifest: Manifest) {
		const key = await manifestKey(deps.privateKey, tokenId);
		const sealed = await seal(
			key,
			utf8(JSON.stringify(manifest)),
			manifestContext,
		);
		const { root } = await store.put(sealed);
		const txHash = await deps.anchor(root);
		return { manifestRoot: root, txHash };
	}

	return {
		load,

		/** Adds (or replaces) one job's result. Returns the entry and the new anchor. */
		async archive(jobId: string, plaintext: Uint8Array) {
			const manifest = await load();
			const entryKey = randomBytes(32);
			const sealed = await seal(entryKey, plaintext, entryContext(jobId));
			const { root } = await store.put(sealed);
			const entry: ManifestEntry = {
				jobId,
				rootHash: root,
				key: toB64url(entryKey),
				size: sealed.length,
				createdAt: new Date().toISOString(),
			};
			manifest.entries = [
				...manifest.entries.filter((e) => e.jobId !== jobId),
				entry,
			];
			return { entry, ...(await save(manifest)) };
		},

		/** Drops one entry and its key, then re-anchors. */
		async remove(jobId: string) {
			const manifest = await load();
			const before = manifest.entries.length;
			manifest.entries = manifest.entries.filter((e) => e.jobId !== jobId);
			if (manifest.entries.length === before) return null;
			return save(manifest);
		},

		/** Everything readable from the chain anchor and the store alone. */
		async restore() {
			const manifest = await load();
			const out: { jobId: string; plaintext: Uint8Array }[] = [];
			for (const e of manifest.entries) {
				const sealed = await store.get(e.rootHash);
				out.push({
					jobId: e.jobId,
					plaintext: await open(
						fromB64url(e.key),
						sealed,
						entryContext(e.jobId),
					),
				});
			}
			return out;
		},
	};
}

export type Vault = ReturnType<typeof createVault>;
