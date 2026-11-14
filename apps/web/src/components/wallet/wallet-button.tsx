// apps/web/src/components/wallet/wallet-button.tsx
"use client";

import { Wallet } from "@phosphor-icons/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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
							onClick={openConnectModal}
						>
							<Wallet aria-hidden size={18} />
							{label}
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
