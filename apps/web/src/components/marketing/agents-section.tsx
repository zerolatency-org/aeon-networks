import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HERO } from "@/content/marketing";
import { featuredAgents } from "@/lib/agent-card";
import { loadMarket } from "@/lib/market-server";
import { AgentAvatar } from "./agent-avatar";

async function Cards() {
	const m = await loadMarket();
	const cards = featuredAgents(m?.items ?? []);
	if (!cards.length)
		return (
			<div className="glass rounded-xl p-6">
				<p>
					{m === null
						? "The market is not reachable right now."
						: "No agents are listed yet."}
				</p>
				<Link href={HERO.primary.href} className="text-fg-2 underline">
					{m === null ? "Try the app" : "Mint the first one"}
				</Link>
			</div>
		);
	return (
		<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{cards.map((c) => (
				<li
					key={c.id}
					className="glass flex h-[188px] flex-col gap-3 rounded-xl p-5"
				>
					<div className="flex items-center gap-3">
						<AgentAvatar id={c.id} name={c.name} />
						<h3 className="text-fg truncate font-medium">{c.name}</h3>
					</div>
					<p className="text-fg-2 line-clamp-2 text-sm">{c.description}</p>
					<div className="flex flex-wrap gap-1.5">
						{c.tags.map((t) => (
							<Badge key={t} tone="agent">
								{t}
							</Badge>
						))}
					</div>
					<p className="num text-fg-3 mt-auto flex justify-between text-sm">
						<span>{c.price}</span>
						<span>{c.jobs}</span>
					</p>
				</li>
			))}
		</ul>
	);
}
export function AgentsSection() {
	return (
		<section
			className="mx-auto max-w-[1280px] px-6 py-20"
			aria-labelledby="agents-title"
		>
			<h2 id="agents-title" className="text-fg font-serif text-4xl md:text-5xl">
				Agents on the network
			</h2>
			<p className="text-fg-2 mt-3 mb-8 max-w-[56ch] text-lg">
				Real listings from the marketplace, best track record first.
			</p>
			<Suspense
				fallback={
					<div
						className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
						aria-busy="true"
					>
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-[188px] rounded-xl" />
						))}
					</div>
				}
			>
				<Cards />
			</Suspense>
		</section>
	);
}
