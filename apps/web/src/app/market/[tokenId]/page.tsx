// apps/web/src/app/market/[tokenId]/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AgentFace } from "@/components/agents/agent-face";
import { card, quiet } from "@/components/agents/styles";
import { HireEntry } from "@/components/market/hire-entry";
import { avatarTint } from "@/lib/avatar";
import { formatOg } from "@/lib/format";
import { fetchMarketAgent } from "@/lib/market-api";
import { plainWordsHistory, trustBadge } from "@/lib/market-trust";

export default function MarketAgentPage() {
	const params = useParams();
	const tokenId = typeof params?.tokenId === "string" ? params.tokenId : "";

	const {
		data: agent,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["market", "agents", tokenId],
		queryFn: () => fetchMarketAgent(tokenId),
		enabled: Boolean(tokenId),
	});

	if (isLoading) {
		return (
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
				<div
					className={`${card} animate-surface-pulse bg-surface-2 h-64`}
					aria-busy="true"
				/>
			</div>
		);
	}

	if (isError || !agent) {
		return (
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
				<div className={`${card} text-center`}>
					<h2 className="font-serif text-2xl font-medium">Agent Not Found</h2>
					<p className="text-fg-2 mt-2 text-sm">
						This agent does not exist or has been delisted from the marketplace.
					</p>
					<div className="mt-4 flex justify-center gap-3">
						<button
							type="button"
							onClick={() => void refetch()}
							className={quiet}
						>
							Retry
						</button>
						<Link href="/market" className={quiet}>
							Back to marketplace
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const face = {
		kind: "dicebear" as const,
		seed: agent.tokenId,
		bg: avatarTint(agent.tokenId),
	};

	const trust = trustBadge(agent.jobsCompleted, agent.jobsDisputed);
	const historyText = plainWordsHistory(
		agent.jobsCompleted,
		agent.jobsDisputed,
	);

	return (
		<div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
			{/* Breadcrumb */}
			<nav aria-label="Breadcrumb">
				<Link
					href="/market"
					className="text-fg-3 hover:text-fg text-xs font-medium transition-colors"
				>
					← Back to Marketplace
				</Link>
			</nav>

			{/* Agent Header Card */}
			<div className={card}>
				<div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex items-start gap-4">
						<AgentFace face={face} size={72} />
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="font-serif text-3xl font-semibold">
									{agent.name}
								</h1>
								<span className="text-fg-3 font-mono text-sm">
									#{agent.tokenId}
								</span>
							</div>
							<p className="text-fg-2 mt-1 text-sm">{historyText}</p>
							{agent.tags && agent.tags.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{agent.tags.map((tag) => (
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
					</div>

					<div className="flex flex-col items-start gap-3 sm:items-end">
						<div className="text-left sm:text-right">
							<span className="text-fg-3 block text-xs">Standard Job Fee</span>
							<span className="text-fg font-mono text-2xl font-semibold">
								{formatOg(BigInt(agent.price))} 0G
							</span>
						</div>
						<HireEntry agent={agent} />
					</div>
				</div>

				<div className="border-border mt-6 border-t pt-5">
					<h2 className="font-serif text-lg font-medium">About this agent</h2>
					<p className="text-fg-2 mt-2 text-sm leading-relaxed whitespace-pre-line">
						{agent.description}
					</p>
				</div>
			</div>

			{/* Operational Performance & Trust Stats */}
			<div className="grid gap-4 sm:grid-cols-3">
				<div className={card}>
					<span className="text-fg-3 block text-xs">Jobs Completed</span>
					<span className="text-fg font-mono text-2xl font-semibold">
						{agent.jobsCompleted}
					</span>
					<span className="text-fg-3 mt-1 block text-xs">
						Successfully delivered & accepted
					</span>
				</div>
				<div className={card}>
					<span className="text-fg-3 block text-xs">Disputed Outcomes</span>
					<span className="text-fg font-mono text-2xl font-semibold">
						{agent.jobsDisputed}
					</span>
					<span className="text-fg-3 mt-1 block text-xs">{trust.text}</span>
				</div>
				<div className={card}>
					<span className="text-fg-3 block text-xs">Total Settled Value</span>
					<span className="text-fg font-mono text-2xl font-semibold">
						{formatOg(BigInt(agent.totalSettled))} 0G
					</span>
					<span className="text-fg-3 mt-1 block text-xs">
						Released from escrow
					</span>
				</div>
			</div>

			{/* On-Chain Verification & Addresses */}
			<div className={card}>
				<h2 className="font-serif text-lg font-medium">On-chain details</h2>
				<dl className="divide-border mt-3 divide-y text-xs">
					<div className="flex justify-between py-2">
						<dt className="text-fg-3">Owner address</dt>
						<dd className="text-fg font-mono">{agent.owner}</dd>
					</div>
					{agent.agentWallet && (
						<div className="flex justify-between py-2">
							<dt className="text-fg-3">Agent wallet</dt>
							<dd className="text-fg font-mono">{agent.agentWallet}</dd>
						</div>
					)}
					{agent.hire && (
						<div className="flex justify-between py-2">
							<dt className="text-fg-3">Escrow contract</dt>
							<dd className="text-fg font-mono">{agent.hire.escrow}</dd>
						</div>
					)}
				</dl>
			</div>
		</div>
	);
}
