// apps/web/src/components/nav/account-slot.tsx
"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useSession } from "@/lib/use-session";

export function AccountSlot() {
	const session = useSession();

	switch (session.status) {
		case "loading":
			return <Skeleton className="h-9 w-28" />;
		case "signed-out":
			return (
				<Button asChild variant="lumen">
					<Link href="/login">Sign in</Link>
				</Button>
			);
		case "needs-wallet":
			return (
				<Button asChild variant="lumen">
					<Link href="/login">Connect wallet</Link>
				</Button>
			);
		case "ready":
			return <WalletButton />;
		case "error":
			return null;
	}
}
