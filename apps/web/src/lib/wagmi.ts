// apps/web/src/lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

import { appChain } from "./chain";
import { env } from "./env";

export const wagmiConfig = getDefaultConfig({
	appName: "Aeon",
	// Empty means WalletConnect will not connect, but browser wallets like MetaMask do.
	projectId: env.walletConnectProjectId || "aeon-local-no-walletconnect",
	chains: [appChain, mainnet, sepolia],
	transports: {
		[appChain.id]: http(env.rpcUrl),
		[mainnet.id]: http(),
		[sepolia.id]: http(),
	},
	ssr: true,
});
