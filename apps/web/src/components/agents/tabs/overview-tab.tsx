// apps/web/src/components/agents/tabs/overview-tab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { extrasKeys, getAgentExtras } from "@/lib/agent-extras";
import { overviewStats } from "@/lib/agent-overview";
import { tabHref } from "@/lib/agent-tabs";
import type { AgentView } from "@/lib/agents-parse";
import { generateEarningsSeries } from "@/lib/earnings-view";
import { balanceStatus } from "@/lib/fund";
import { fetchJobsList, type JobView } from "@/lib/jobs-api";

import { EarningsChart } from "../earnings-chart";
import { card, primary, quiet } from "../styles";

export function OverviewTab({ agent }: { agent: AgentView }) {
	const extras = useQuery({
		queryKey: extrasKeys.one(agent.id, agent.tokenId),
		queryFn: () => getAgentExtras(agent.id, agent.tokenId),
	});

	const jobsQuery = useQuery({
		queryKey: ["jobs"],
		queryFn: () => fetchJobsList(),
	});

	const agentJobs: JobView[] = (jobsQuery.data?.jobs ?? []).filter(
		(j) => j.tokenId === agent.tokenId,
	);

	const series = generateEarningsSeries(agentJobs);
	const stats = overviewStats(agent, extras.data ?? null);
	const status = balanceStatus(agent.balanceWei);
	const needsFunds = status === "empty" || status === "low";

	return (
		<div className="space-y-6">
			{/* Header info & Quick chat button */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{agent.description ? (
					<p className="text-fg-2 max-w-prose text-sm leading-relaxed">
						{agent.description}
					</p>
				) : (
					<div />
				)}
				<Link href={`/chats/new?agentId=${agent.id}`} className={quiet}>
					Chat with agent →
				</Link>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{stats.map((s) => (
					<div key={s.key} className={card}>
						<p className="text-fg-2 text-sm">{s.label}</p>
						<p className="num text-fg mt-1 text-xl">{s.value}</p>
						{s.note && <p className="text-fg-3 mt-1 text-sm">{s.note}</p>}
					</div>
				))}
			</div>

			{/* Visual Earnings Chart */}
			<EarningsChart series={series} />

			{needsFunds && (
				<div className={`${card} flex items-center justify-between gap-4`}>
					<p className="text-sm">
						This agent needs 0G before it can pay gas for jobs.
					</p>
					<Link href={tabHref(agent.id, "wallet")} className={primary}>
						Add funds
					</Link>
				</div>
			)}

			<div className={card}>
				<h2 className="font-serif text-xl">Recent jobs</h2>
				{agentJobs.length === 0 ? (
					<p className="text-fg-2 mt-1 text-sm">
						No jobs to show yet. Finished jobs will appear here.
					</p>
				) : (
					<div className="divide-border mt-3 divide-y font-mono text-xs">
						{agentJobs.slice(0, 5).map((j) => (
							<Link
								key={j.jobId}
								href={`/jobs/${j.jobId}`}
								className="hover:text-lumen flex items-center justify-between py-2.5 transition-colors"
							>
								<span>Job #{j.jobId}</span>
								<span>{j.state}</span>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
