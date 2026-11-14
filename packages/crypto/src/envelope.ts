import { decrypt, encrypt } from "eciesjs";
import { type Address, type Hex, keccak256 } from "viem";
import { privateKeyToAddress, publicKeyToAddress } from "viem/accounts";

import { aesDecrypt, aesEncrypt, randomBytes } from "./aes";
import {
	canonicalJson,
	fromB64url,
	fromUtf8,
	toB64url,
	utf8,
} from "./encoding";

export type EnvelopeAad = {
	chainId: number;
	escrow: Address;
	tokenId: string;
	client: Address;
	kind: "task" | "result" | "archive";
};

export type Envelope = {
	v: 1;
	alg: "A256GCM";
	iv: string;
	ct: string;
	aad: EnvelopeAad;
	keys: Record<string, string>;
	meta?: { maxResultBytes?: number; contentType?: string };
};

export type Recipient = { address: Address; publicKey: Hex };

export class NotARecipientError extends Error {
	constructor(readonly address: string) {
		super("NOT_A_RECIPIENT");
		this.name = "NotARecipientError";
	}
}

const strip0x = (h: string) => h.replace(/^0x/, "");

export const wrapKey = (publicKey: Hex, key: Uint8Array) =>
	encrypt(strip0x(publicKey), key);

export const unwrapKey = (privateKey: Hex, wrapped: Uint8Array) =>
	decrypt(strip0x(privateKey), wrapped);

export async function createEnvelope(opts: {
	plaintext: Uint8Array;
	aad: EnvelopeAad;
	recipients: Recipient[];
	meta?: Envelope["meta"];
}): Promise<Envelope> {
	if (opts.recipients.length === 0) throw new Error("no recipients");
	const aad = normalizeAad(opts.aad);
	const contentKey = randomBytes(32);
	const { iv, ct } = await aesEncrypt(
		contentKey,
		opts.plaintext,
		utf8(canonicalJson(aad)),
	);
	const keys: Record<string, string> = {};
	for (const r of opts.recipients) {
		if (
			publicKeyToAddress(r.publicKey).toLowerCase() !== r.address.toLowerCase()
		) {
			throw new Error(`public key does not belong to ${r.address}`);
		}
		keys[r.address.toLowerCase()] = toB64url(wrapKey(r.publicKey, contentKey));
	}
	return {
		v: 1,
		alg: "A256GCM",
		iv: toB64url(iv),
		ct: toB64url(ct),
		aad,
		keys,
		meta: opts.meta,
	};
}

export async function openEnvelope(
	env: Envelope,
	privateKey: Hex,
): Promise<Uint8Array> {
	const address = privateKeyToAddress(privateKey).toLowerCase();
	const wrapped = env.keys[address];
	if (!wrapped) throw new NotARecipientError(address);
	const contentKey = unwrapKey(privateKey, fromB64url(wrapped));
	return aesDecrypt(
		contentKey,
		fromB64url(env.iv),
		fromB64url(env.ct),
		utf8(canonicalJson(normalizeAad(env.aad))),
	);
}

export const serializeEnvelope = (env: Envelope) => utf8(canonicalJson(env));

export function parseEnvelope(bytes: Uint8Array): Envelope {
	const env = JSON.parse(fromUtf8(bytes)) as Envelope;
	if (env.v !== 1 || env.alg !== "A256GCM")
		throw new Error("unsupported envelope");
	return env;
}

export const envelopeHash = (env: Envelope) =>
	keccak256(serializeEnvelope(env));

function normalizeAad(aad: EnvelopeAad): EnvelopeAad {
	return {
		...aad,
		escrow: aad.escrow.toLowerCase() as Address,
		client: aad.client.toLowerCase() as Address,
	};
}
