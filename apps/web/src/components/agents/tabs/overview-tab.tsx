// apps/web/src/components/agents/tabs/overview-tab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { extrasKeys, getAgentExtras } from "@/lib/agent-extras";
import { overviewStats } from "@/lib/agent-overview";
import { tabHref } from "@/lib/agent-tabs";
import type { AgentView } from "@/lib/agents-parse";
import { balanceStatus } from "@/lib/fund";

import { card, primary } from "../styles";

export function OverviewTab({ agent }: { agent: AgentView }) {
	const extras = useQuery({
		queryKey: extrasKeys.one(agent.id),
		queryFn: () => getAgentExtras(agent.id),
	});
	const stats = overviewStats(agent, extras.data ?? null);
	const status = balanceStatus(agent.balanceWei);
	const needsFunds = status === "empty" || status === "low";

	return (
		<div className="space-y-6">
			{agent.description && (
				<p className="text-fg-2 max-w-prose">{agent.description}</p>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{stats.map((s) => (
					<div key={s.key} className={card}>
						<p className="text-fg-2 text-sm">{s.label}</p>
						<p className="num text-fg mt-1 text-xl">{s.value}</p>
						{s.note && <p className="text-fg-3 mt-1 text-sm">{s.note}</p>}
					</div>
				))}
			</div>

			{needsFunds && (
				<div className={`${card} flex items-center justify-between gap-4`}>
					<p>This agent needs 0G before it can pay gas for jobs.</p>
					<Link href={tabHref(agent.id, "wallet")} className={primary}>
						Add funds
					</Link>
				</div>
			)}

			<div className={card}>
				<h2 className="font-serif text-xl">Recent jobs</h2>
				<p className="text-fg-2 mt-1">
					No jobs to show yet. Finished jobs will appear here.
				</p>
			</div>
		</div>
	);
}
