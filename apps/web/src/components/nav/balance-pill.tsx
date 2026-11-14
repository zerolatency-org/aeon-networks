// apps/web/src/components/nav/balance-pill.tsx
"use client";

import { CaretDown } from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import { useAccount, useBalance } from "wagmi";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NetworkBadge } from "@/components/wallet/network-badge";
import { WalletButton } from "@/components/wallet/wallet-button";
import { balanceView, menuRows } from "@/lib/balance";
import { addressUrl, GALILEO_ID } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { networkState } from "@/lib/network";
import { cn } from "@/lib/utils";

export function BalancePill({ address }: { address: `0x${string}` }) {
	const account = useAccount();
	const balance = useBalance({
		address,
		chainId: GALILEO_ID,
		query: { refetchInterval: 30_000 },
	});

	const wrongNetwork =
		networkState(
			{ isConnected: account.isConnected, chainId: account.chainId },
			GALILEO_ID,
		) === "wrong-network";
	const view = balanceView({
		wrongNetwork,
		isPending: balance.isPending,
		isError: balance.isError,
		value: balance.data?.value,
	});
	const rows = menuRows({
		balanceText: view.kind === "loading" ? "Loading…" : view.text,
	});

	return (
		<Popover.Root>
			<Popover.Trigger asChild>
				<Button
					variant="outline"
					className="rounded-full"
					aria-label="Wallet and balance"
				>
					{view.kind === "loading" ? (
						<Skeleton className="h-4 w-16" />
					) : (
						<span className={cn("num", view.kind !== "ok" && "text-coral")}>
							{view.text}
						</span>
					)}
					<CaretDown aria-hidden size={14} />
				</Button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					align="end"
					sideOffset={8}
					className="glass z-50 w-72 rounded-xl p-4 outline-none"
				>
					<div className="flex items-center justify-between gap-3">
						<span className="num text-[15px]">{shortAddress(address)}</span>
						{account.isConnected ? (
							<NetworkBadge />
						) : (
							<WalletButton size="sm" label="Connect wallet" />
						)}
					</div>

					<dl className="mt-4 flex flex-col gap-3">
						{rows.map((row) => (
							<div
								key={row.id}
								className="flex items-baseline justify-between gap-3"
							>
								<dt className="text-fg-2">{row.label}</dt>
								<dd className={row.live ? "num" : "text-fg-3"}>{row.value}</dd>
							</div>
						))}
					</dl>

					<a
						href={addressUrl(address)}
						target="_blank"
						rel="noreferrer"
						className="text-lumen-fg mt-4 inline-block text-[13px] underline"
					>
						View on Chainscan
					</a>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
