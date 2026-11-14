// apps/web/src/lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { appChain } from "./chain";
import { env } from "./env";

export const wagmiConfig = getDefaultConfig({
	appName: "Aeon",
	// Empty means WalletConnect will not connect, but browser wallets like MetaMask do.
	projectId: env.walletConnectProjectId || "aeon-local-no-walletconnect",
	chains: [appChain],
	transports: { [appChain.id]: http(env.rpcUrl) },
	ssr: true,
});
