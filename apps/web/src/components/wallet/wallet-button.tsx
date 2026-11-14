// apps/web/src/components/wallet/wallet-button.tsx
"use client";

import { Wallet } from "@phosphor-icons/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { useConnect } from "wagmi";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortAddress } from "@/lib/format";

export function WalletButton({
	label = "Connect wallet",
	variant = "default",
	size = "md",
	className,
}: {
	label?: string;
	variant?: ButtonProps["variant"];
	size?: ButtonProps["size"];
	className?: string;
}) {
	const { connectAsync, connectors } = useConnect();
	const [connecting, setConnecting] = useState(false);

	async function handleConnect(openConnectModal?: () => void) {
		// Prefer direct injected/MetaMask connector if available to bypass modal relay hangs
		const metaMaskOrInjected = connectors.find(
			(c) =>
				c.id === "io.metamask" || c.id === "metaMaskSDK" || c.id === "injected",
		);

		const ethWindow =
			typeof window !== "undefined"
				? (window as unknown as { ethereum?: unknown })
				: null;

		if (metaMaskOrInjected && ethWindow?.ethereum) {
			setConnecting(true);
			try {
				// If multiple wallet extensions (TronLink, OKX, etc.) are installed, target MetaMask directly
				const eth = ethWindow.ethereum as {
					providers?: Array<{
						isMetaMask?: boolean;
						request?: (args: { method: string }) => Promise<unknown>;
					}>;
					request?: (args: { method: string }) => Promise<unknown>;
				};
				const targetProvider = eth.providers?.find((p) => p.isMetaMask) ?? eth;
				if (targetProvider && typeof targetProvider.request === "function") {
					await targetProvider.request({ method: "eth_requestAccounts" });
				}
				await connectAsync({ connector: metaMaskOrInjected });
				return;
			} catch (err) {
				console.warn("Direct wallet connect fallback to modal:", err);
			} finally {
				setConnecting(false);
			}
		}

		if (openConnectModal) {
			openConnectModal();
		}
	}

	return (
		<ConnectButton.Custom>
			{({ account, mounted, openAccountModal, openConnectModal }) => {
				if (!mounted) return <Skeleton className="h-9 w-36" />;
				if (!account) {
					return (
						<Button
							variant={variant}
							size={size}
							className={className}
							disabled={connecting}
							onClick={() => void handleConnect(openConnectModal)}
						>
							<Wallet aria-hidden size={18} />
							{connecting ? "Connecting…" : label}
						</Button>
					);
				}
				return (
					<Button
						variant="outline"
						size={size}
						className={className}
						onClick={openAccountModal}
					>
						<span className="num">{shortAddress(account.address)}</span>
					</Button>
				);
			}}
		</ConnectButton.Custom>
	);
}
