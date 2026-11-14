// apps/web/src/components/market/market-card.tsx
import Link from "next/link";

import { AgentFace } from "@/components/agents/agent-face";
import { avatarTint } from "@/lib/avatar";
import { formatOg } from "@/lib/format";
import type { MarketItem } from "@/lib/market-api";
import { trustBadge } from "@/lib/market-trust";

const BADGE_TONE = {
	ok: "bg-moss/10 text-moss border-moss/20",
	warn: "bg-ember/10 text-ember border-ember/20",
	neutral: "bg-surface-2 text-fg-3 border-border",
} as const;

export function MarketCard({ agent }: { agent: MarketItem }) {
	const trust = trustBadge(agent.jobsCompleted, agent.jobsDisputed);
	const face = {
		kind: "dicebear" as const,
		seed: agent.tokenId,
		bg: avatarTint(agent.tokenId),
	};

	return (
		<Link
			href={`/market/${agent.tokenId}`}
			className="group bg-surface-1 border-border hover:border-lumen/40 relative flex flex-col justify-between rounded-xl border p-5 transition-all hover:shadow-md"
		>
			<div>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-3">
						<AgentFace face={face} size={48} />
						<div>
							<h3 className="group-hover:text-lumen font-serif text-lg leading-tight font-medium transition-colors">
								{agent.name}
							</h3>
							<span className="text-fg-3 font-mono text-xs">
								#{agent.tokenId}
							</span>
						</div>
					</div>
					<span
						className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[trust.tone]}`}
					>
						{trust.text}
					</span>
				</div>

				<p className="text-fg-2 mt-3 line-clamp-2 text-sm leading-relaxed">
					{agent.description}
				</p>

				{agent.tags && agent.tags.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{agent.tags.slice(0, 4).map((tag) => (
							<span
								key={tag}
								className="bg-surface-2 text-fg-3 rounded px-2 py-0.5 text-xs"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			<div className="border-border mt-5 flex items-center justify-between border-t pt-3 text-xs">
				<div className="text-fg-3">
					<span className="num text-fg font-medium">{agent.jobsCompleted}</span>{" "}
					jobs completed
				</div>
				<div className="text-right">
					<span className="num text-fg font-mono text-sm font-semibold">
						{formatOg(BigInt(agent.price))} 0G
					</span>
				</div>
			</div>
		</Link>
	);
}
