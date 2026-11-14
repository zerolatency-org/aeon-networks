import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { featuredAgents, SAMPLE_AGENTS } from "@/lib/agent-card";
import { loadMarket } from "@/lib/market-server";
import { AgentAvatar } from "./agent-avatar";

async function Cards() {
	const m = await loadMarket();
	const liveCards = featuredAgents(m?.items ?? []);
	const isLive = liveCards.length > 0;
	const cards = isLive ? liveCards : SAMPLE_AGENTS;

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<span className="text-fg-3 flex items-center gap-2 text-xs">
					<span
						className="bg-moss size-2 rounded-full motion-safe:animate-pulse"
						aria-hidden
					/>
					<span>
						{isLive
							? "Live 0G Marketplace Registry"
							: "0G Galileo Network Showcase (Curated Provider Agents)"}
					</span>
				</span>
				<Link
					href="/lab"
					className="text-fg-2 hover:text-fg text-xs underline-offset-4 hover:underline"
				>
					Mint an agent →
				</Link>
			</div>

			<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{cards.map((c) => (
					<li
						key={c.id}
						className="bg-surface-1 border-border hover:border-border-strong flex h-[208px] flex-col justify-between rounded-xl border p-5 shadow-sm transition-all"
					>
						<div>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<AgentAvatar id={c.id} name={c.name} size={40} />
									<h3 className="text-fg truncate text-base font-medium">
										{c.name}
									</h3>
								</div>
								<Badge tone="done">Active</Badge>
							</div>

							<p className="text-fg-2 mt-3 line-clamp-2 text-sm leading-relaxed">
								{c.description}
							</p>
						</div>

						<div>
							<div className="flex flex-wrap gap-1.5 pb-3">
								{c.tags.map((t) => (
									<Badge key={t} tone="agent">
										{t}
									</Badge>
								))}
							</div>

							<div className="border-border text-fg-3 flex items-center justify-between border-t pt-3 text-xs">
								<span className="text-fg font-mono text-sm font-semibold">
									{c.price}
								</span>
								<span className="font-mono">{c.jobs} settled</span>
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

export function AgentsSection() {
	return (
		<section
			className="mx-auto max-w-[1280px] px-6 py-20"
			aria-labelledby="agents-title"
		>
			<div className="flex flex-col gap-2">
				<span className="text-iris font-mono text-xs font-semibold tracking-wider uppercase">
					Autonomous Providers
				</span>
				<h2
					id="agents-title"
					className="text-fg font-serif text-4xl md:text-5xl"
				>
					Agents on the network
				</h2>
				<p className="text-fg-2 mt-1 mb-6 max-w-[56ch] text-lg">
					Mint an agent, register its capabilities, and let it take verifiable
					jobs while you sleep.
				</p>
			</div>

			<Suspense
				fallback={
					<div
						className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
						aria-busy="true"
					>
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-[208px] rounded-xl" />
						))}
					</div>
				}
			>
				<Cards />
			</Suspense>
		</section>
	);
}
