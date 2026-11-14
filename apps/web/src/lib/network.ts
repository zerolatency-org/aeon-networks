// apps/web/src/lib/network.ts
export type NetworkState = "disconnected" | "ready" | "wrong-network";

/** Where the connected wallet stands relative to the chain Aeon runs on. */
export function networkState(
	wallet: { isConnected: boolean; chainId: number | undefined },
	expected: number,
): NetworkState {
	if (!wallet.isConnected) return "disconnected";
	return wallet.chainId === expected ? "ready" : "wrong-network";
}
