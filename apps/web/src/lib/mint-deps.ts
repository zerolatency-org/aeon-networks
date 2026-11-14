// apps/web/src/lib/mint-deps.ts
// Connects the mint runner to the real world: the owner's wallet, the chain, the server and the
// clock. The wallet and chain come in as two small functions (wagmi's, passed by the hook), so
// this file has no React and is tested with fakes.
import { confirmAgent, prepareAgent, setAvatar, setPolicy } from "./agents-api";
import type { Hex } from "./agents-parse";
import type { MintDeps } from "./mint-runner";

export type ChainBits = {
	/** wagmi's sendTransactionAsync: resolves with the hash once the wallet has signed and sent. */
	sendTransaction: (args: {
		chainId: number;
		to: Hex;
		value: bigint;
		data: Hex;
	}) => Promise<Hex>;
	/** The public client's waitForTransactionReceipt, reduced to the one field used. */
	waitForReceipt: (hash: Hex) => Promise<{ status: "success" | "reverted" }>;
};

type ApiPart = Pick<
	MintDeps,
	"prepare" | "confirm" | "saveAvatar" | "savePolicy" | "sleep"
>;

const realApi: ApiPart = {
	prepare: (input) => prepareAgent(input),
	confirm: (input) => confirmAgent(input),
	saveAvatar: (id, choice) => setAvatar(id, choice),
	savePolicy: (id, policy) => setPolicy(id, policy),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Everything `runMint` needs. Pass `api` to replace server calls or the clock (tests do). */
export function makeMintDeps(
	chain: ChainBits,
	api: Partial<ApiPart> = {},
): MintDeps {
	return {
		...realApi,
		...api,
		sendTx: (tx) =>
			chain.sendTransaction({
				chainId: tx.chainId,
				to: tx.to,
				value: BigInt(tx.value),
				data: tx.data,
			}),
		waitMined: async (hash) => (await chain.waitForReceipt(hash)).status,
	};
}
