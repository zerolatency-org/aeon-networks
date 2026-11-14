// apps/web/src/app/(app)/chats/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AgentFace } from "@/components/agents/agent-face";
import { card, primary } from "@/components/agents/styles";
import { agentKeys, listAgents } from "@/lib/agents-api";
import { avatarTint } from "@/lib/avatar";
import { type ChatThread, deleteThread, loadThreads } from "@/lib/chat-storage";

export default function ChatsPage() {
	const [threads, setThreads] = useState<ChatThread[]>([]);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		setThreads(loadThreads());
	}, []);

	const { data: agents = [] } = useQuery({
		queryKey: agentKeys.list(),
		queryFn: () => listAgents(),
	});

	const handleDelete = (id: string, e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (confirm("Delete this conversation thread?")) {
			deleteThread(id);
			setThreads(loadThreads());
		}
	};

	const filteredThreads = threads.filter(
		(t) =>
			t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.agentName.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-serif text-4xl font-semibold">Chats</h1>
					<p className="text-fg-2 mt-1 text-sm">
						Private, stateless conversations with your agents powered by 0G
						nodes.
					</p>
				</div>
			</div>

			{/* Agent Quick-Start Bar */}
			{agents.length > 0 && (
				<div className={card}>
					<h2 className="font-serif text-lg font-medium">Start a new chat</h2>
					<p className="text-fg-3 mt-0.5 text-xs">
						Pick one of your minted agents to converse with:
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{agents.map((ag) => (
							<Link
								key={ag.id}
								href={`/chats/new?agentId=${ag.id}`}
								className="border-border bg-surface-2 hover:bg-surface-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
							>
								<AgentFace
									face={{
										kind: "dicebear",
										seed: ag.id,
										bg: avatarTint(ag.id),
									}}
									size={24}
								/>
								<span className="text-fg">{ag.name}</span>
							</Link>
						))}
					</div>
				</div>
			)}

			{/* Search */}
			{threads.length > 0 && (
				<div className="relative">
					<input
						type="search"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search threads..."
						className="bg-surface-1 border-border text-fg placeholder:text-fg-3 h-10 w-full rounded-lg border px-3 text-sm focus:outline-hidden"
					/>
				</div>
			)}

			{/* Thread List */}
			{filteredThreads.length === 0 ? (
				<div className="border-border rounded-xl border border-dashed p-12 text-center">
					<h3 className="font-serif text-lg font-medium">
						No chat threads yet
					</h3>
					<p className="text-fg-2 mx-auto mt-1 max-w-sm text-sm">
						Select an agent above or visit your agents dashboard to initiate a
						conversation.
					</p>
					<div className="mt-4 flex justify-center">
						<Link href="/agents" className={primary}>
							View your agents
						</Link>
					</div>
				</div>
			) : (
				<div className="divide-border bg-surface-1 border-border divide-y rounded-xl border">
					{filteredThreads.map((thread) => (
						<Link
							key={thread.id}
							href={`/chats/${thread.id}?agentId=${thread.agentId}`}
							className="hover:bg-surface-2/60 flex items-center justify-between p-4 transition-colors"
						>
							<div className="flex items-center gap-3">
								<AgentFace
									face={{
										kind: "dicebear",
										seed: thread.agentId,
										bg: avatarTint(thread.agentId),
									}}
									size={40}
								/>
								<div>
									<h3 className="text-fg text-sm font-medium">
										{thread.title}
									</h3>
									<span className="text-fg-3 text-xs">
										{thread.agentName} · {thread.messages.length} messages ·{" "}
										{new Date(thread.updatedAt).toLocaleDateString()}
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={(e) => handleDelete(thread.id, e)}
								className="text-fg-3 hover:text-ember p-2 text-xs transition-colors"
								title="Delete thread"
							>
								✕
							</button>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
