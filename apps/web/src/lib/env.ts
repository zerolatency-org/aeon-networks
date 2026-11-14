// apps/web/src/lib/env.ts
// Public settings for the browser. Next.js only inlines NEXT_PUBLIC_* values
// when they are written as literal `process.env.NEXT_PUBLIC_X` reads, so the
// bottom of this file lists them one by one instead of passing `process.env`.

export type WebEnv = {
	apiUrl: string;
	rpcUrl: string;
	explorerUrl: string;
	walletConnectProjectId: string;
};

export type RawEnv = {
	NEXT_PUBLIC_API_URL?: string | undefined;
	NEXT_PUBLIC_RPC_URL?: string | undefined;
	NEXT_PUBLIC_EXPLORER_URL?: string | undefined;
	NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?: string | undefined;
};

export const DEFAULTS: WebEnv = {
	apiUrl: "http://localhost:3000",
	rpcUrl: "https://evmrpc-testnet.0g.ai",
	explorerUrl: "https://chainscan-galileo.0g.ai",
	walletConnectProjectId: "",
};

function cleanUrl(
	name: string,
	value: string | undefined,
	fallback: string,
): string {
	const raw = value?.trim();
	if (!raw) return fallback;
	try {
		new URL(raw);
	} catch {
		throw new Error(
			`${name} must be a full URL like https://example.com, got "${raw}"`,
		);
	}
	return raw.replace(/\/+$/, "");
}

export function readEnv(raw: RawEnv): WebEnv {
	return {
		apiUrl: cleanUrl(
			"NEXT_PUBLIC_API_URL",
			raw.NEXT_PUBLIC_API_URL,
			DEFAULTS.apiUrl,
		),
		rpcUrl: cleanUrl(
			"NEXT_PUBLIC_RPC_URL",
			raw.NEXT_PUBLIC_RPC_URL,
			DEFAULTS.rpcUrl,
		),
		explorerUrl: cleanUrl(
			"NEXT_PUBLIC_EXPLORER_URL",
			raw.NEXT_PUBLIC_EXPLORER_URL,
			DEFAULTS.explorerUrl,
		),
		walletConnectProjectId:
			raw.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "",
	};
}

export const env: WebEnv = readEnv({
	NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
	NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL,
	NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
		process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
});

/** Link to a transaction on the Galileo explorer. */
export function txUrl(hash: string): string {
	return `${env.explorerUrl}/tx/${hash}`;
}
