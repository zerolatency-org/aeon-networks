// apps/web/src/lib/wagmi.ts
import { connectorsForWallets, type Wallet } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

import { appChain } from "./chain";
import { env } from "./env";

const METAMASK_ICON =
	"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%20viewBox%3D%220%200%2028%2028%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%200h28v28H0z%22%2F%3E%3Cg%20clip-path%3D%22url(%23a)%22%3E%3Cpath%20fill%3D%22%23ff5c16%22%20d%3D%22m24.024%2023.824-4.846-1.434-3.655%202.172-2.55-.001-3.656-2.171-4.844%201.434L3%2018.88l1.473-5.488L3%208.751%204.473%203l7.569%204.496h4.413L24.024%203l1.473%205.751-1.473%204.64%201.473%205.488z%22%2F%3E%3Cpath%20fill%3D%22%23ff5c16%22%20d%3D%22m4.474%203%207.57%204.499-.302%203.087zm4.844%2015.881%203.33%202.522-3.33.987zm3.064-4.17-.64-4.123-4.097%202.804h-.002v.001l.013%202.886%201.661-1.567zM24.024%203l-7.57%204.499.3%203.087zM19.18%2018.881l-3.33%202.522%203.33.987zm1.674-5.488v-.002zl-4.097-2.804-.64%204.124h3.064l1.662%201.567z%22%2F%3E%3Cpath%20fill%3D%22%23e34807%22%20d%3D%22m9.317%2022.39-4.844%201.434L3%2018.881h6.317zm3.064-7.68.925%205.962-1.282-3.315-4.37-1.078%201.662-1.568zm6.799%207.68%204.844%201.434%201.473-4.943H19.18zm-3.064-7.68-.925%205.962%201.282-3.315%204.37-1.078-1.663-1.568z%22%2F%3E%3Cpath%20fill%3D%22%23ff8d5d%22%20d%3D%22m3%2018.88%201.473-5.489h3.169l.012%202.887%204.37%201.078%201.282%203.314-.659.73-3.33-2.522H3zm22.497%200-1.473-5.489h-3.17l-.01%202.887-4.371%201.078-1.282%203.314.659.73%203.33-2.522h6.317zM16.455%207.495h-4.413l-.3%203.087%201.565%2010.084h1.884l1.565-10.084z%22%2F%3E%3Cpath%20fill%3D%22%23661800%22%20d%3D%22M4.473%203%203%208.751l1.473%204.64h3.169l4.1-2.805zm6.992%2012.908H10.03l-.781.761%202.776.685-.56-1.447M24.024%203l1.473%205.751-1.473%204.64h-3.17l-4.098-2.805zm-6.99%2012.908h1.437l.782.762-2.78.686.56-1.45zm-1.512%206.687.328-1.193-.66-.73h-1.885l-.659.73.327%201.192%22%2F%3E%3Cpath%20fill%3D%22%23c0c4cd%22%20d%3D%22M15.522%2022.594v1.969h-2.548v-1.969z%22%2F%3E%3Cpath%20fill%3D%22%23e7ebf6%22%20d%3D%22m9.318%2022.388%203.658%202.174v-1.969l-.328-1.192zm9.862%200-3.658%202.174v-1.969l.328-1.192z%22%2F%3E%3C%2Fg%3E%3Cdefs%3E%3CclipPath%20id%3D%22a%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M3%203h22.5v21.563H3z%22%2F%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3C%2Fsvg%3E";

const INJECTED_ICON =
	"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%200h28v28H0z%22%2F%3E%3Crect%20width%3D%2220%22%20height%3D%2216%22%20x%3D%224%22%20y%3D%226%22%20fill%3D%22%230E76FD%22%20rx%3D%223.5%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M16%2014a3%203%200%200%201%203-3h4.4c.56%200%20.84%200%201.054.109a1%201%200%200%201%20.437.437C25%2011.76%2025%2012.04%2025%2012.6v2.8c0%20.56%200%20.84-.109%201.054a1%201%200%200%201-.437.437C24.24%2017%2023.96%2017%2023.4%2017H19a3%203%200%200%201-3-3Z%22%2F%3E%3Ccircle%20cx%3D%2219%22%20cy%3D%2214%22%20r%3D%221.25%22%20fill%3D%22%23A3D7FF%22%2F%3E%3C%2Fsvg%3E";

const WALLETCONNECT_ICON =
	"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20fill%3D%22none%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M0%200h28v28H0z%22%2F%3E%3Cpath%20fill%3D%22%233B99FC%22%20d%3D%22M8.13%209.68a8.3%208.3%200%200%201%2011.74%200l.39.39a.52.52%200%200%201%200%20.74l-1.33%201.33a.26.26%200%200%201-.37%200l-.58-.58a5.72%205.72%200%200%200-8.08%200l-.62.62a.26.26%200%200%201-.37%200L7.58%2010.8a.52.52%200%200%201%200-.74zm14.3%202.56%201.18%201.18a.52.52%200%200%201%200%20.74l-5.32%205.32a.52.52%200%200%201-.74%200l-3.55-3.55a.26.26%200%200%200-.37%200l-3.55%203.55a.52.52%200%200%201-.74%200l-5.32-5.32a.52.52%200%200%201%200-.74l1.18-1.18a.52.52%200%200%201%20.74%200l3.92%203.92c.1.1.27.1.37%200l3.55-3.55a.52.52%200%200%201%20.74%200l3.55%203.55c.1.1.27.1.37%200l3.92-3.92a.52.52%200%200%201%20.74%200z%22%2F%3E%3C%2Fsvg%3E";

function metaMaskWallet(): Wallet {
	return {
		id: "metaMask",
		name: "MetaMask",
		rdns: "io.metamask",
		iconUrl: METAMASK_ICON,
		iconBackground: "#fff",
		installed:
			typeof window !== "undefined" &&
			Boolean(
				(window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum
					?.isMetaMask,
			),
		downloadUrls: {
			browserExtension: "https://metamask.io/download",
			chrome:
				"https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
			firefox: "https://addons.mozilla.org/firefox/addon/ether-metamask",
			edge: "https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm",
		},
		createConnector: (walletDetails) => (config) => ({
			...injected({ target: "metaMask" })(config),
			...walletDetails,
		}),
	};
}

function browserWallet(): Wallet {
	return {
		id: "injected",
		name: "Browser Wallet",
		iconUrl: INJECTED_ICON,
		iconBackground: "#fff",
		installed:
			typeof window !== "undefined" &&
			Boolean((window as unknown as { ethereum?: unknown }).ethereum),
		createConnector: (walletDetails) => (config) => ({
			...injected()(config),
			...walletDetails,
		}),
	};
}

function walletConnectCustom(projectId: string): Wallet {
	return {
		id: "walletConnect",
		name: "WalletConnect",
		iconUrl: WALLETCONNECT_ICON,
		iconBackground: "#fff",
		createConnector: (walletDetails) => (config) => ({
			...walletConnect({ projectId })(config),
			...walletDetails,
		}),
	};
}

const walletList: Array<() => Wallet> = [metaMaskWallet, browserWallet];
if (env.walletConnectProjectId) {
	const projectId = env.walletConnectProjectId;
	walletList.push(() => walletConnectCustom(projectId));
}

const connectors = connectorsForWallets(
	[
		{
			groupName: "Popular",
			wallets: walletList,
		},
	],
	{
		appName: "Aeon",
		projectId: env.walletConnectProjectId || "aeon-wallet",
	},
);

export const wagmiConfig = createConfig({
	connectors,
	chains: [appChain, mainnet, sepolia],
	transports: {
		[appChain.id]: http(env.rpcUrl),
		[mainnet.id]: http(),
		[sepolia.id]: http(),
	},
	ssr: true,
});
