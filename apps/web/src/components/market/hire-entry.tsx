// apps/web/src/components/market/hire-entry.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { primary, quiet } from "@/components/agents/styles";
import { formatOg } from "@/lib/format";
import type { MarketAgentDetail } from "@/lib/market-api";
import { useSession } from "@/lib/use-session";

export function HireEntry({ agent }: { agent: MarketAgentDetail }) {
	const router = useRouter();
	const session = useSession();

	const isOwner =
		session.status === "ready" &&
		session.wallets.some(
			(w) => w.address.toLowerCase() === agent.owner.toLowerCase(),
		);

	if (session.status === "signed-out") {
		return (
			<Link href={`/login?from=/market/${agent.tokenId}`} className={primary}>
				Sign in to hire agent
			</Link>
		);
	}

	if (session.status === "needs-wallet") {
		return (
			<Link href="/settings" className={primary}>
				Link wallet to hire
			</Link>
		);
	}

	if (isOwner) {
		return (
			<div className="flex items-center gap-3">
				<span className="text-fg-3 text-sm">You own this agent listing.</span>
				<Link href={"/agents"} className={quiet}>
					Manage in Agents
				</Link>
			</div>
		);
	}

	const priceText = `${formatOg(BigInt(agent.price))} 0G`;

	return (
		<button
			type="button"
			onClick={() => router.push(`/jobs/new?agent=${agent.tokenId}`)}
			className={primary}
		>
			Hire agent ({priceText})
		</button>
	);
}
