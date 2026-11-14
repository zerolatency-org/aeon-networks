// apps/web/src/components/agents/agent-page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { headerView } from "@/lib/agent-overview";
import { TABS, type TabId, tabHref } from "@/lib/agent-tabs";
import { agentKeys, getAgent } from "@/lib/agents-api";
import { avatarTint } from "@/lib/avatar";
import { fromServerAvatar } from "@/lib/avatar-choice";
import { shouldRetry } from "@/lib/retry";

import { AgentFace } from "./agent-face";
import { card, quiet } from "./styles";
// import { ActivityTab } from "./tabs/activity-tab";
// import { ListingTab } from "./tabs/listing-tab";
// import { MemoryTab } from "./tabs/memory-tab";
import { OverviewTab } from "./tabs/overview-tab";

// import { PolicyTab } from "./tabs/policy-tab";
// import { WalletTab } from "./tabs/wallet-tab";

const TONE = { ok: "text-moss", warn: "text-ember" } as const;

export function AgentPage({ id, tab }: { id: string; tab: TabId }) {
	const query = useQuery({
		queryKey: agentKeys.one(id),
		queryFn: () => getAgent(id),
		retry: shouldRetry,
	});

	if (query.isPending)
		return (
			<div
				className={`${card} animate-surface-pulse bg-surface-2 h-40`}
				aria-busy="true"
			/>
		);

	if (query.isError) {
		return (
			<div className={card}>
				<p>We could not find this agent. It may belong to another account.</p>
				<div className="mt-3 flex gap-3">
					<button
						type="button"
						className={quiet}
						onClick={() => void query.refetch()}
					>
						Try again
					</button>
					<Link href="/agents" className={quiet}>
						All agents
					</Link>
				</div>
			</div>
		);
	}

	const agent = query.data;
	const head = headerView(agent);
	const face = fromServerAvatar(agent.avatarKind, agent.avatarRef) ?? {
		kind: "dicebear" as const,
		seed: agent.id.toLowerCase(),
		bg: avatarTint(agent.id),
	};

	return (
		<div className="space-y-8">
			<header className="flex items-center gap-4">
				<AgentFace face={face} size={72} />
				<div>
					<h1 className="font-serif text-4xl">{head.name}</h1>
					<p className="text-sm">
						<span className={TONE[head.tone]}>{head.status}</span>
						<span className="num text-fg-2"> · {head.balance}</span>
					</p>
				</div>
			</header>

			<nav
				aria-label="Agent sections"
				className="border-border flex flex-wrap gap-2 border-b pb-2"
			>
				{TABS.map((t) => (
					<Link
						key={t.id}
						href={tabHref(id, t.id)}
						aria-current={t.id === tab ? "page" : undefined}
						className={`rounded-md px-3 py-1.5 ${t.id === tab ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg"}`}
					>
						{t.label}
					</Link>
				))}
			</nav>

			{tab === "overview" && <OverviewTab agent={agent} />}
			{/* {tab === "wallet" && <WalletTab agent={agent} />} */}
			{/* {tab === "listing" && <ListingTab agent={agent} />} */}
			{/* {tab === "policy" && <PolicyTab agent={agent} />} */}
			{/* {tab === "memory" && <MemoryTab />} */}
			{/* {tab === "activity" && <ActivityTab />} */}
		</div>
	);
}
