// apps/web/src/app/(app)/chats/new/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { card } from "@/components/agents/styles";
import { ChatView } from "@/components/chat/chat-view";
import { agentKeys, getAgent } from "@/lib/agents-api";

function NewChatContent() {
	const searchParams = useSearchParams();
	const agentId = searchParams.get("agentId") ?? "";

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
				<p className="text-fg-2">Please select an agent to chat with.</p>
			</div>
		);
	}

	return <ChatView agent={agent} />;
}

export default function NewChatPage() {
	return (
		<Suspense
			fallback={
				<div
					className={`${card} animate-surface-pulse bg-surface-2 mx-auto h-64 max-w-3xl`}
					aria-busy="true"
				/>
			}
		>
			<NewChatContent />
		</Suspense>
	);
}
