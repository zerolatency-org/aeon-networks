// apps/web/src/components/nav/account-slot.tsx
"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/use-session";
import { BalancePill } from "./balance-pill";

export function AccountSlot() {
	const session = useSession();

	switch (session.status) {
		case "loading":
			return <Skeleton className="h-9 w-28" />;
		case "signed-out":
			return (
				<Button asChild variant="lumen">
					<Link href="/login">Launch app</Link>
				</Button>
			);
		case "needs-wallet":
			return (
				<Button asChild variant="lumen">
					<Link href="/login">Connect wallet</Link>
				</Button>
			);
		case "ready":
			return <BalancePill address={session.wallet.address} />;
		case "error":
			return null;
	}
}
