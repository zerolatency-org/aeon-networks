// scripts/lib.ts
// Shared by the P9/P10 demos: a signed-in API client and a wallet that sends what the
// API returns. Keys must be funded THROWAWAY keys, never your main wallet.
import { createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

export async function connect(key: Hex) {
	const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
	const DOMAIN = process.env.SIWE_DOMAIN ?? new URL(BASE_URL).host;
	const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
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
	let token = "";

	async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await fetch(`${BASE_URL}${path}`, {
			...init,
			headers: {
				"content-type": "application/json",
				origin: BASE_URL,
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
		});
		if (!res.ok)
			throw new Error(`${path} -> ${res.status} ${await res.text()}`);
		return (await res.json()) as T;
	}
	const post = <T>(path: string, body: unknown, method = "POST") =>
		api<T>(path, { method, body: JSON.stringify(body) });

	const { nonce } = await post<{ nonce: string }>("/api/auth/siwe/nonce", {});
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
	token = (
		await post<{ token: string }>("/api/auth/siwe/verify", {
			message,
			signature: await account.signMessage({ message }),
		})
	).token;

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

	return { account, chainId, api, post, sendTx };
}

/** Polls `read` every 5 s until `done` says so, or throws after `timeoutS`. */
export async function waitUntil<T>(
	label: string,
	read: () => Promise<T>,
	done: (v: T) => boolean,
	timeoutS = 600,
): Promise<T> {
	const until = Date.now() + timeoutS * 1000;
	for (;;) {
		const v = await read();
		if (done(v)) return v;
		if (Date.now() > until) throw new Error(`timed out waiting for ${label}`);
		await Bun.sleep(5_000);
	}
}
