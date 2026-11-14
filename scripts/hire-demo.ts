// scripts/hire-demo.ts
// P8 "done when": one wallet hires another account's listed agent while that owner is
// offline. The worker (indexer + provider + keeper) must be running against the same chain.
//   BUYER_KEY=0x... TOKEN_ID=<listed token> bun scripts/hire-demo.ts
//   TASK="..." ACCEPT_WINDOW_S=60 EXPIRES_IN_S=900 BASE_URL=... OG_RPC_URL=... bun scripts/hire-demo.ts
// BUYER_KEY must be a funded THROWAWAY key, never your main wallet. It pays the job price.
import { createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

import {
	createEnvelope,
	deriveVaultKey,
	type Envelope,
	envelopeHash,
	openEnvelope,
	utf8,
	vaultKeyMessage,
} from "../packages/crypto/src/index";

const BASE_URL = process.env.BASE_URL ?? "<http://localhost:3000>";
const DOMAIN = process.env.SIWE_DOMAIN ?? new URL(BASE_URL).host;
const RPC = process.env.OG_RPC_URL ?? "<https://evmrpc-testnet.0g.ai>";
const TOKEN_ID = process.env.TOKEN_ID;
const TASK =
	process.env.TASK ?? "In three bullet points, explain what an escrow is.";
const ACCEPT_WINDOW_S = Number(process.env.ACCEPT_WINDOW_S ?? 60);
const EXPIRES_IN_S = Number(process.env.EXPIRES_IN_S ?? 900);
const key = process.env.BUYER_KEY as Hex | undefined;
if (!key) throw new Error("set BUYER_KEY (a funded throwaway key)");
if (!TOKEN_ID)
	throw new Error("set TOKEN_ID (a listed agent owned by another account)");

const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ transport: http(RPC) });
const chainId = await publicClient.getChainId();
const wallet = createWalletClient({
	account,
	chain: {
		id: chainId,
		name: `chain-${chainId}`,
		nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
		rpcUrls: { default: { http: [RPC] } },
	},
	transport: http(RPC),
});

async function api<T>(
	path: string,
	init: RequestInit & { token?: string } = {},
): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			origin: BASE_URL,
			...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
		},
	});
	if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
	return (await res.json()) as T;
}

async function sendTx(
	tx: { to: Hex; data: Hex; value: string },
	label: string,
) {
	const hash = await wallet.sendTransaction({
		to: tx.to,
		data: tx.data,
		value: BigInt(tx.value),
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	console.log(
		`${label}: ${hash} (block ${receipt.blockNumber}, ${receipt.status})`,
	);
	if (receipt.status !== "success") throw new Error(`${label} reverted`);
	return hash;
}

// 1. sign in, and derive the vault key that will read the result
const { nonce } = await api<{ nonce: string }>("/api/auth/siwe/nonce", {
	method: "POST",
	body: "{}",
});
const message = createSiweMessage({
	domain: DOMAIN,
	address: account.address,
	statement: "Sign in to Aeon",
	uri: BASE_URL,
	version: "1",
	chainId,
	nonce,
	issuedAt: new Date(),
});
const { token } = await api<{ token: string }>("/api/auth/siwe/verify", {
	method: "POST",
	body: JSON.stringify({
		message,
		signature: await account.signMessage({ message }),
	}),
});
const vault = await deriveVaultKey(
	await account.signMessage({
		message: vaultKeyMessage(account.address, chainId),
	}),
);
console.log(`signed in as ${account.address}; vault key ${vault.address}`);

// 2. look the agent up and encrypt the task for it (and for our own vault key)
const agent = await api<{
	name: string;
	price: string;
	agentWallet: Hex;
	hire: { chainId: number; escrow: Hex; agentPublicKey: Hex } | null;
}>(`/api/market/agents/${TOKEN_ID}`);
if (!agent.hire)
	throw new Error("this server cannot hire that agent (no agent services)");
const env = await createEnvelope({
	plaintext: utf8(TASK),
	aad: {
		chainId: agent.hire.chainId,
		escrow: agent.hire.escrow,
		tokenId: TOKEN_ID,
		client: account.address,
		kind: "task",
	},
	recipients: [
		vault,
		{ address: agent.agentWallet, publicKey: agent.hire.agentPublicKey },
	],
});
console.log(`hiring ${agent.name} (#${TOKEN_ID}) for ${agent.price} wei`);

// 3. prepare -> createJob -> confirm -> deliver the task
const prepared = await api<{ tx: { to: Hex; data: Hex; value: string } }>(
	"/api/jobs/prepare",
	{
		method: "POST",
		token,
		body: JSON.stringify({
			tokenId: TOKEN_ID,
			taskHash: envelopeHash(env),
			expiresInS: EXPIRES_IN_S,
			acceptWindowS: ACCEPT_WINDOW_S,
		}),
	},
);
const txHash = await sendTx(prepared.tx, "createJob");
const { job } = await api<{ job: { jobId: string } }>("/api/jobs/confirm", {
	method: "POST",
	token,
	body: JSON.stringify({ txHash }),
});
await api(`/api/jobs/${job.jobId}/delivery/task`, {
	method: "PUT",
	token,
	body: JSON.stringify({ envelope: env }),
});
console.log(`job ${job.jobId}: task delivered; waiting for the provider...`);

// 4. wait for the provider (the owner is offline; the worker does the work)
async function waitFor(states: string[], timeoutS: number) {
	const until = Date.now() + timeoutS * 1000;
	for (;;) {
		const j = await api<{
			state: string;
			providerRun: { status: string; errorCode: string | null } | null;
		}>(`/api/jobs/${job.jobId}`, { token });
		if (states.includes(j.state)) return j;
		if (j.providerRun?.status === "failed") {
			throw new Error(`provider failed: ${j.providerRun.errorCode}`);
		}
		if (Date.now() > until)
			throw new Error(`still ${j.state} after ${timeoutS}s`);
		await Bun.sleep(5_000);
	}
}
await waitFor(["submitted", "completed", "timed_out"], EXPIRES_IN_S);
const result = await api<{
	storage: string;
	ogRootHash: string | null;
	envelope: Envelope | null;
}>(`/api/jobs/${job.jobId}/delivery/result`, { token });
if (result.envelope) {
	const { content } = JSON.parse(
		new TextDecoder().decode(
			await openEnvelope(result.envelope, vault.privateKey),
		),
	) as { content: string };
	console.log(`\nresult (decrypted with your vault key):\n${content}\n`);
} else {
	console.log(`result is on 0G Storage, root ${result.ogRootHash}`);
}

// 5. we stay silent as the evaluator; after the window the keeper pays the provider's owner
console.log(
	`not judging it: the keeper should pay out after ${ACCEPT_WINDOW_S}s...`,
);
await waitFor(["timed_out", "completed"], ACCEPT_WINDOW_S + 180);
console.log(
	`job ${job.jobId} settled: the provider's owner was paid while offline`,
);
