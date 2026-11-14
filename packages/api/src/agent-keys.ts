// packages/api/src/agent-keys.ts
// Server-held agent wallets: open the sealed key for one action, sign with it, and
// reach the agent's vault (its archive on 0G, anchored on its token).
import { aeonAgentNftAbi } from "@aeon/chain";
import { fromUtf8 } from "@aeon/crypto/encoding";
import type { BlobStore } from "@aeon/storage";
import { createVault, type Vault } from "@aeon/vault";
import {
	type Chain,
	createWalletClient,
	custom,
	type Hex,
	type PrivateKeyAccount,
	type Transport,
	type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { AeonServices } from "./context";
import { sealContext } from "./routers/agents";

/** Opens an agent wallet's private key. Keep it for one action, then drop it. */
export async function openAgentKey(
	aeon: AeonServices,
	wallet: { address: string; keyCipher: Uint8Array | Buffer },
): Promise<Hex> {
	return fromUtf8(
		await aeon.box.open(
			new Uint8Array(wallet.keyCipher),
			sealContext.walletKey(wallet.address),
		),
	) as Hex;
}

/** A wallet client for a server-held key, sending through the same RPC as the reads. */
export type ServerSigner = WalletClient<
	Transport,
	Chain | undefined,
	PrivateKeyAccount
>;

export function serverSigner(
	aeon: AeonServices,
	privateKey: Hex,
): ServerSigner {
	const client = aeon.client;
	return createWalletClient({
		account: privateKeyToAccount(privateKey),
		chain: client.chain,
		transport: custom({ request: (args) => client.request(args as never) }),
	});
}

/** The agent's vault: its key is the agent wallet key; its anchor is the token's manifest slot. */
export function agentVault(
	aeon: AeonServices,
	store: BlobStore,
	agent: { tokenId: bigint; privateKey: Hex },
): Vault {
	const signer = serverSigner(aeon, agent.privateKey);
	return createVault({
		store,
		privateKey: agent.privateKey,
		tokenId: agent.tokenId,
		readAnchor: () =>
			aeon.client.readContract({
				address: aeon.deployment.nft,
				abi: aeonAgentNftAbi,
				functionName: "manifestOf",
				args: [agent.tokenId],
			}),
		anchor: async (root) => {
			const hash = await signer.writeContract({
				address: aeon.deployment.nft,
				abi: aeonAgentNftAbi,
				functionName: "anchorManifest",
				args: [agent.tokenId, root],
				chain: signer.chain,
			});
			const receipt = await aeon.client.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") throw new Error("anchor reverted");
			return hash;
		},
	});
}
