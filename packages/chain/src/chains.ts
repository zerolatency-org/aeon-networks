import { type Chain, defineChain } from "viem";
import { foundry } from "viem/chains";

/** 0G Galileo testnet. */
export const galileo: Chain = defineChain({
	id: 16602,
	name: "0G Galileo Testnet",
	nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
	rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
	blockExplorers: {
		default: { name: "Chainscan", url: "https://chainscan-galileo.0g.ai" },
	},
	testnet: true,
});

/** Local anvil node (chain id 31337). */
export const anvil: Chain = foundry;

const KNOWN: Record<number, Chain> = {
	[galileo.id]: galileo,
	[anvil.id]: anvil,
};

export function chainFor(id: number, rpcUrl?: string): Chain {
	const known = KNOWN[id];
	if (known) return known;
	return defineChain({
		id,
		name: `chain-${id}`,
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: { default: { http: rpcUrl ? [rpcUrl] : [] } },
	});
}
