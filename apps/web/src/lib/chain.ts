// apps/web/src/lib/chain.ts
// The Galileo chain for the browser. Imported from @aeon/chain/chains, never from
// @aeon/chain: its index pulls in node:fs, which cannot be bundled for the browser.
import { galileo } from "@aeon/chain/chains";
import type { Chain } from "viem";

import { env } from "./env";

export const GALILEO_ID: number = galileo.id;

/** Galileo with the RPC and explorer this deployment uses. */
export function webChain(input: {
	rpcUrl: string;
	explorerUrl: string;
}): Chain {
	return {
		...galileo,
		rpcUrls: { default: { http: [input.rpcUrl] } },
		blockExplorers: { default: { name: "Chainscan", url: input.explorerUrl } },
	};
}

export const appChain: Chain = webChain({
	rpcUrl: env.rpcUrl,
	explorerUrl: env.explorerUrl,
});

/** Link to an address on the Galileo explorer. */
export function addressUrl(address: string): string {
	return `${env.explorerUrl}/address/${address}`;
}
