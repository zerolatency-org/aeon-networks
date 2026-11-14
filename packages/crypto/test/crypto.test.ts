import { describe, expect, test } from "bun:test";
import { privateKeyToAccount, signMessage } from "viem/accounts";

import {
	aesDecrypt,
	aesEncrypt,
	createAgentWallet,
	createEnvelope,
	createSecretBox,
	DecryptError,
	deriveVaultKey,
	type EnvelopeAad,
	envelopeHash,
	envelopeRecipients,
	NotARecipientError,
	openEnvelope,
	parseEnvelope,
	randomBytes,
	serializeEnvelope,
	unwrapKey,
	utf8,
	vaultKeyMessage,
	wrapKey,
} from "../src/index";

const text = new TextDecoder();
const aad: EnvelopeAad = {
	chainId: 16602,
	escrow: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
	tokenId: "7",
	client: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
	kind: "task",
};

describe("AES-256-GCM", () => {
	test("round trip with AAD", async () => {
		const key = randomBytes(32);
		const { iv, ct } = await aesEncrypt(key, utf8("hello"), utf8("ctx"));
		expect(text.decode(await aesDecrypt(key, iv, ct, utf8("ctx")))).toBe(
			"hello",
		);
	});

	test("a flipped byte, a wrong key or different AAD all fail", async () => {
		const key = randomBytes(32);
		const { iv, ct } = await aesEncrypt(key, utf8("hello"), utf8("ctx"));
		const flipped = ct.slice();
		flipped[0] = (flipped[0] ?? 0) ^ 1;
		await expect(aesDecrypt(key, iv, flipped, utf8("ctx"))).rejects.toThrow(
			DecryptError,
		);
		await expect(
			aesDecrypt(randomBytes(32), iv, ct, utf8("ctx")),
		).rejects.toThrow(DecryptError);
		await expect(aesDecrypt(key, iv, ct, utf8("other"))).rejects.toThrow(
			DecryptError,
		);
	});
});

describe("ECIES key wrapping", () => {
	test("wrap for a public key, unwrap with its private key", () => {
		const w = createAgentWallet();
		const key = randomBytes(32);
		expect(unwrapKey(w.privateKey, wrapKey(w.publicKey, key))).toEqual(key);
	});

	test("another private key cannot unwrap", () => {
		const a = createAgentWallet();
		const b = createAgentWallet();
		expect(() =>
			unwrapKey(b.privateKey, wrapKey(a.publicKey, randomBytes(32))),
		).toThrow();
	});
});

describe("envelope v1", () => {
	const recipients = () => [
		createAgentWallet(),
		createAgentWallet(),
		createAgentWallet(),
	];

	test("every recipient opens it, an outsider cannot", async () => {
		const rs = recipients();
		const env = await createEnvelope({
			plaintext: utf8("the task"),
			aad,
			recipients: rs,
		});
		for (const r of rs) {
			expect(text.decode(await openEnvelope(env, r.privateKey))).toBe(
				"the task",
			);
		}
		await expect(
			openEnvelope(env, createAgentWallet().privateKey),
		).rejects.toThrow(NotARecipientError);
	});

	test("serializes canonically, parses back, and the hash covers wrapped keys", async () => {
		const rs = recipients();
		const env = await createEnvelope({
			plaintext: utf8("x"),
			aad,
			recipients: rs,
		});
		const back = parseEnvelope(serializeEnvelope(env));
		expect(envelopeHash(back)).toBe(envelopeHash(env));

		const [first] = Object.keys(env.keys);
		const swapped = {
			...env,
			keys: { ...env.keys, [first as string]: "AAAA" },
		};
		expect(envelopeHash(swapped)).not.toBe(envelopeHash(env));
	});

	test("changing the AAD makes it undecryptable", async () => {
		const r = createAgentWallet();
		const env = await createEnvelope({
			plaintext: utf8("x"),
			aad,
			recipients: [r],
		});
		const moved = { ...env, aad: { ...env.aad, tokenId: "8" } };
		await expect(openEnvelope(moved, r.privateKey)).rejects.toThrow(
			DecryptError,
		);
	});

	test("rejects a recipient whose public key belongs to another address", async () => {
		const a = createAgentWallet();
		const b = createAgentWallet();
		await expect(
			createEnvelope({
				plaintext: utf8("x"),
				aad,
				recipients: [{ address: a.address, publicKey: b.publicKey }],
			}),
		).rejects.toThrow();
	});

	test("envelopeRecipients returns every recipient with their address and public key", async () => {
		const rs = recipients();
		const env = await createEnvelope({
			plaintext: utf8("task"),
			aad,
			recipients: rs,
		});
		expect(envelopeRecipients(env)).toEqual(
			rs.map((r) => ({
				address: r.address.toLowerCase(),
				publicKey: r.publicKey,
			})),
		);
	});

	test("envelopeRecipients throws if a public key does not belong to the address", () => {
		const a = createAgentWallet();
		const b = createAgentWallet();
		const fakeEnv = {
			v: 1 as const,
			alg: "AES-256-GCM+ECIES-secp256k1" as const,
			iv: "AAAA",
			ct: "AAAA",
			aad,
			keys: { [a.address.toLowerCase()]: "AAAA" },
			meta: { publicKeys: { [a.address.toLowerCase()]: b.publicKey } },
		};
		expect(() => envelopeRecipients(fakeEnv)).toThrow();
	});
});

describe("secret box (MASTER_KEY)", () => {
	const box = createSecretBox(`0x${"11".repeat(32)}`);

	test("seals and opens in the same context only", async () => {
		const sealed = await box.seal(utf8("agent key"), "agent-wallet:1");
		expect(text.decode(await box.open(sealed, "agent-wallet:1"))).toBe(
			"agent key",
		);
		await expect(box.open(sealed, "agent-wallet:2")).rejects.toThrow(
			DecryptError,
		);
		const other = createSecretBox(`0x${"22".repeat(32)}`);
		await expect(other.open(sealed, "agent-wallet:1")).rejects.toThrow(
			DecryptError,
		);
	});

	test("refuses a master key that is not 32 bytes", () => {
		expect(() => createSecretBox("0x1234")).toThrow();
	});
});

describe("vault key", () => {
	test("the same wallet signature always derives the same key", async () => {
		const wallet = privateKeyToAccount(createAgentWallet().privateKey);
		const message = vaultKeyMessage(wallet.address, 16602);
		expect(message).toBe(
			`Aeon vault key v1 | ${wallet.address.toLowerCase()} | 16602`,
		);
		const sig = await wallet.signMessage({ message });
		const again = await signMessage({
			message,
			privateKey: createAgentWallet().privateKey,
		});
		const a = await deriveVaultKey(sig);
		const b = await deriveVaultKey(sig);
		expect(a.address).toBe(b.address);
		expect((await deriveVaultKey(again)).address).not.toBe(a.address);
	});
});
