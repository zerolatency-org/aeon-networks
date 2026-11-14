// apps/web/src/app/(app)/chats/[id]/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { card } from "@/components/agents/styles";
import { ChatView } from "@/components/chat/chat-view";
import { agentKeys, getAgent } from "@/lib/agents-api";
import { getThread } from "@/lib/chat-storage";

function ChatThreadContent() {
	const params = useParams();
	const searchParams = useSearchParams();

	const threadId = typeof params?.id === "string" ? params.id : "";
	const thread = getThread(threadId);

	const agentId = thread?.agentId || searchParams.get("agentId") || "";

	const {
		data: agent,
		isLoading,
		isError,
	} = useQuery({
		queryKey: agentKeys.one(agentId),
		queryFn: () => getAgent(agentId),
		enabled: Boolean(agentId),
	});

	if (isLoading) {
		return (
			<div
				className={`${card} animate-surface-pulse bg-surface-2 mx-auto h-64 max-w-3xl`}
				aria-busy="true"
			/>
		);
	}

	if (isError || !agent) {
		return (
			<div className={`${card} mx-auto max-w-xl text-center`}>
				<p className="text-fg-2">Agent not found for this thread.</p>
			</div>
		);
	}

	return <ChatView agent={agent} initialThreadId={threadId} />;
}

export default function ChatDetailPage() {
	return (
		<Suspense
			fallback={
				<div
					className={`${card} animate-surface-pulse bg-surface-2 mx-auto h-64 max-w-3xl`}
					aria-busy="true"
				/>
			}
		>
			<ChatThreadContent />
		</Suspense>
	);
}
