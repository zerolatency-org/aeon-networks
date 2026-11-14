// apps/web/src/components/wallet/network-badge.tsx
"use client";

import { useAccount, useSwitchChain } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GALILEO_ID } from "@/lib/chain";
import { networkState } from "@/lib/network";

export function NetworkBadge() {
	const { isConnected, chainId } = useAccount();
	const { switchChain, isPending } = useSwitchChain();
	const state = networkState({ isConnected, chainId }, GALILEO_ID);

	if (state === "disconnected") return null;
	if (state === "ready") return <Badge tone="done">Galileo</Badge>;

	return (
		<div className="flex items-center gap-2">
			<Badge tone="danger">Wrong network</Badge>
			<Button
				size="sm"
				variant="outline"
				disabled={isPending}
				onClick={() => switchChain({ chainId: GALILEO_ID })}
			>
				{isPending ? "Switching…" : "Switch to Galileo"}
			</Button>
		</div>
	);
}
