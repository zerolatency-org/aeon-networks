import { ab, concat } from "./encoding";

export class DecryptError extends Error {
	constructor() {
		super("DECRYPT_FAILED");
		this.name = "DecryptError";
	}
}

const importKey = (key: Uint8Array) => {
	if (key.length !== 32) throw new Error("AES key must be 32 bytes");
	return crypto.subtle.importKey("raw", ab(key), "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
};

export const randomBytes = (n: number) =>
	crypto.getRandomValues(new Uint8Array(n));

export async function aesEncrypt(
	key: Uint8Array,
	plaintext: Uint8Array,
	aad: Uint8Array = new Uint8Array(),
) {
	const iv = randomBytes(12);
	const ct = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: ab(iv), additionalData: ab(aad) },
		await importKey(key),
		ab(plaintext),
	);
	return { iv, ct: new Uint8Array(ct) };
}

export async function aesDecrypt(
	key: Uint8Array,
	iv: Uint8Array,
	ct: Uint8Array,
	aad: Uint8Array = new Uint8Array(),
) {
	try {
		const pt = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: ab(iv), additionalData: ab(aad) },
			await importKey(key),
			ab(ct),
		);
		return new Uint8Array(pt);
	} catch {
		throw new DecryptError();
	}
}

export function createSecretBox(masterKeyHex: string, version = 1) {
	const key = new Uint8Array(
		Buffer.from(masterKeyHex.replace(/^0x/, ""), "hex"),
	);
	if (key.length !== 32) throw new Error("MASTER_KEY must be 32 bytes of hex");
	const ctx = (context: string) => new TextEncoder().encode(context);
	return {
		version,
		async seal(plaintext: Uint8Array, context: string) {
			const { iv, ct } = await aesEncrypt(key, plaintext, ctx(context));
			return concat(new Uint8Array([version]), iv, ct);
		},
		async open(sealed: Uint8Array, context: string) {
			if (sealed[0] !== version) throw new DecryptError();
			return aesDecrypt(
				key,
				sealed.slice(1, 13),
				sealed.slice(13),
				ctx(context),
			);
		},
	};
}

export type SecretBox = ReturnType<typeof createSecretBox>;
