import { type Address, type Hex, hexToBytes, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { ab, utf8 } from "./encoding";

export type KeyPair = { privateKey: Hex; publicKey: Hex; address: Address };

const pair = (privateKey: Hex): KeyPair => {
	const account = privateKeyToAccount(privateKey);
	return { privateKey, publicKey: account.publicKey, address: account.address };
};

export const createAgentWallet = (): KeyPair => pair(generatePrivateKey());

export const vaultKeyMessage = (address: Address, chainId: number) =>
	`Aeon vault key v1 | ${address.toLowerCase()} | ${chainId}`;

export async function deriveVaultKey(signature: Hex): Promise<KeyPair> {
	const ikm = await crypto.subtle.importKey(
		"raw",
		ab(hexToBytes(signature)),
		"HKDF",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt: ab(utf8("aeon")),
			info: ab(utf8("aeon-vault-v1")),
		},
		ikm,
		256,
	);
	return pair(toHex(new Uint8Array(bits)));
}
