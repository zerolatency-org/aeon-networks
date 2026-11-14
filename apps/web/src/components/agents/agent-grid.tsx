// apps/web/src/components/agents/agent-grid.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import {
	type AgentRow,
	agentRow,
	listSummary,
	sortAgents,
} from "@/lib/agent-list";
import { agentKeys, listAgents } from "@/lib/agents-api";
import type { BalanceStatus } from "@/lib/fund";
import { shouldRetry } from "@/lib/retry";

import { AgentFace } from "./agent-face";
import { card, primary, quiet } from "./styles";

// Meaning colors: moss = fine, ember = needs attention, coral = cannot work, grey = unknown.
const FUNDING: Record<BalanceStatus, { label: string; tone: string }> = {
	ready: { label: "Funded", tone: "text-moss" },
	low: { label: "Low", tone: "text-ember" },
	empty: { label: "Empty", tone: "text-coral" },
	unknown: { label: "Unknown", tone: "text-fg-3" },
};

function AgentCard({ row }: { row: AgentRow }) {
	const funding = FUNDING[row.funding];
	return (
		<Link
			href={row.href}
			className={`${card} hover:bg-surface-2 block transition-colors`}
		>
			<div className="flex items-center gap-3">
				<AgentFace face={row.face} size={56} />
				<div className="min-w-0">
					<h2 className="truncate font-serif text-xl">{row.name}</h2>
					<p className="num text-fg-3 truncate">{row.model}</p>
				</div>
			</div>
			{row.description && <p className="text-fg-2 mt-3">{row.description}</p>}
			<div className="mt-4 flex items-center justify-between">
				<span className="num">{row.balance}</span>
				<span className={`text-sm ${funding.tone}`}>{funding.label}</span>
			</div>
		</Link>
	);
}

function Skeleton() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className={`${card} animate-surface-pulse bg-surface-2 h-40`}
				/>
			))}
		</div>
	);
}

export function AgentGrid() {
	const query = useQuery({
		queryKey: agentKeys.list(),
		queryFn: () => listAgents(),
		retry: shouldRetry,
	});

	if (query.isPending) return <Skeleton />;

	if (query.isError) {
		return (
			<div className={card}>
				<p>Could not load your agents.</p>
				<button
					type="button"
					className={`${quiet} mt-3`}
					onClick={() => void query.refetch()}
				>
					Try again
				</button>
			</div>
		);
	}

	const agents = sortAgents(query.data);
	if (agents.length === 0) {
		return (
			<div className={`${card} text-center`}>
				<h2 className="font-serif text-2xl">No agents yet</h2>
				<p className="text-fg-2 mx-auto mt-2 max-w-md">
					Mint your first agent: give it a face, a model and a persona, and set
					what it may spend.
				</p>
				<Link href="/agents/new" className={`${primary} mt-4 inline-block`}>
					New agent
				</Link>
			</div>
		);
	}

	return (
		<>
			<p className="text-fg-2 mb-4">{listSummary(agents)}</p>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{agents.map((a) => (
					<AgentCard key={a.id} row={agentRow(a)} />
				))}
			</div>
		</>
	);
}
