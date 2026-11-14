// apps/web/src/components/providers/wallet-providers.tsx
"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
	darkTheme,
	lightTheme,
	RainbowKitProvider,
	type Theme,
} from "@rainbow-me/rainbowkit";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";
import { WALLET_COLORS } from "@/lib/wallet-theme";

function aeonTheme(mode: "dark" | "light"): Theme {
	const base = (mode === "dark" ? darkTheme : lightTheme)({
		borderRadius: "medium",
		fontStack: "system",
		overlayBlur: "small",
	});
	return {
		...base,
		colors: { ...base.colors, ...WALLET_COLORS },
		fonts: { body: "var(--font-instrument-sans), system-ui, sans-serif" },
	};
}

const DARK = aeonTheme("dark");
const LIGHT = aeonTheme("light");

/** wagmi and RainbowKit. Needs QueryProvider above it, which wagmi uses for its reads. */
export function WalletProviders({ children }: { children: ReactNode }) {
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<WagmiProvider config={wagmiConfig}>
			<RainbowKitProvider
				modalSize="compact"
				theme={mounted && resolvedTheme === "light" ? LIGHT : DARK}
			>
				{children}
			</RainbowKitProvider>
		</WagmiProvider>
	);
}
