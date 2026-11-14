// apps/web/src/components/chat/chat-view.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useReducer, useRef, useState } from "react";

import type { AgentView } from "@/lib/agents-parse";
import type { ModelPricing } from "@/lib/chat-cost";
import {
	type ChatState,
	chatReducer,
	initialChatState,
} from "@/lib/chat-reducer";
import { type ChatThread, getThread, saveThread } from "@/lib/chat-storage";
import { createStreamParser } from "@/lib/chat-stream";
import { ChatComposer } from "./chat-composer";
import { ChatMessages } from "./chat-messages";

export function ChatView({
	agent,
	initialThreadId,
}: {
	agent: AgentView;
	initialThreadId?: string;
}) {
	const threadId = useRef(initialThreadId ?? `t_${agent.id}_${Date.now()}`);
	const existing = useRef<ChatThread | null>(
		initialThreadId ? getThread(initialThreadId) : null,
	);

	const [state, dispatch] = useReducer(chatReducer, {
		...initialChatState,
		messages: existing.current?.messages ?? [],
		usage: existing.current?.totalUsage ?? null,
	});

	const [input, setInput] = useState("");
	const abortControllerRef = useRef<AbortController | null>(null);

	const { data: modelsData } = useQuery({
		queryKey: ["models"],
		queryFn: async () => {
			const res = await fetch("/api/models");
			if (!res.ok) return { models: [] };
			return (await res.json()) as { models: ModelPricing[] };
		},
		staleTime: 60_000,
	});

	const currentModelPricing = modelsData?.models.find(
		(m) => m.id === agent.model,
	);

	const persistState = useCallback(
		(nextState: ChatState) => {
			if (nextState.messages.length === 0) return;
			const firstUser = nextState.messages.find((m) => m.role === "user");
			const title =
				firstUser?.content.slice(0, 36) || `Chat with ${agent.name}`;
			saveThread({
				id: threadId.current,
				agentId: agent.id,
				agentName: agent.name,
				title,
				createdAt: existing.current?.createdAt ?? new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				messages: nextState.messages,
				totalUsage: nextState.usage ?? undefined,
			});
		},
		[agent.id, agent.name],
	);

	const runTurn = async (
		messagesPayload: { role: "user" | "assistant"; content: string }[],
	) => {
		abortControllerRef.current = new AbortController();
		const parser = createStreamParser();

		try {
			const res = await fetch(`/api/agents/${agent.id}/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ messages: messagesPayload }),
				signal: abortControllerRef.current.signal,
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					code?: string;
					message?: string;
				};
				dispatch({
					type: "error",
					message: body.message || body.code || "Chat turn failed",
				});
				return;
			}

			if (!res.body) {
				dispatch({
					type: "error",
					message: "Empty response stream from server",
				});
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				parser.feed(chunk, (event) => {
					if (event.type === "text") {
						dispatch({ type: "text_chunk", text: event.text });
					} else if (event.type === "tool_call") {
						dispatch({
							type: "tool_call",
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							args: event.args,
						});
					} else if (event.type === "tool_result") {
						dispatch({
							type: "tool_result",
							toolCallId: event.toolCallId,
							result: event.result,
						});
					} else if (event.type === "finish") {
						dispatch({ type: "finish", usage: event.usage });
					} else if (event.type === "error") {
						dispatch({ type: "error", message: event.error });
					}
				});
			}

			parser.end((event) => {
				if (event.type === "text") {
					dispatch({ type: "text_chunk", text: event.text });
				} else if (event.type === "finish") {
					dispatch({ type: "finish", usage: event.usage });
				}
			});

			dispatch({ type: "finish" });
		} catch (err: unknown) {
			if ((err as Error)?.name === "AbortError") {
				dispatch({ type: "stop" });
			} else {
				dispatch({
					type: "error",
					message: (err as Error)?.message || "Chat network failure",
				});
			}
		} finally {
			abortControllerRef.current = null;
			persistState(state);
		}
	};

	const handleSend = () => {
		const trimmed = input.trim();
		if (!trimmed || state.status === "streaming") return;

		const userMsgId = `m_${Date.now()}`;
		const asstMsgId = `m_${Date.now() + 1}`;

		dispatch({
			type: "send",
			id: userMsgId,
			assistantId: asstMsgId,
			content: trimmed,
		});
		setInput("");

		// Prepare messages payload for API (up to 40 recent messages)
		const history = state.messages
			.filter((m) => m.content.trim() !== "")
			.map((m) => ({ role: m.role, content: m.content }));
		history.push({ role: "user", content: trimmed });

		void runTurn(history.slice(-40));
	};

	const handleStop = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		dispatch({ type: "stop" });
	};

	const handleRetry = () => {
		const newAsstId = `m_${Date.now()}`;
		dispatch({ type: "retry", newAssistantId: newAsstId });

		const history = state.messages
			.filter((m) => m.content.trim() !== "")
			.map((m) => ({ role: m.role, content: m.content }));

		void runTurn(history.slice(-40));
	};

	const handleEditLast = (newPrompt: string) => {
		const newAsstId = `m_${Date.now()}`;
		dispatch({
			type: "edit_last",
			content: newPrompt,
			newAssistantId: newAsstId,
		});

		const history = state.messages
			.slice(0, -2) // remove old user + assistant pair
			.filter((m) => m.content.trim() !== "")
			.map((m) => ({ role: m.role, content: m.content }));
		history.push({ role: "user", content: newPrompt });

		void runTurn(history.slice(-40));
	};

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
			<header className="border-border mb-6 flex items-center justify-between border-b pb-4">
				<div>
					<h1 className="font-serif text-2xl font-semibold">{agent.name}</h1>
					<p className="text-fg-3 text-xs">
						Model: {agent.model} · #{agent.tokenId}
					</p>
				</div>
			</header>

			<ChatMessages
				messages={state.messages}
				agentId={agent.id}
				agentName={agent.name}
				isStreaming={state.status === "streaming"}
				modelPricing={currentModelPricing}
				latestUsage={state.usage}
				onRetry={handleRetry}
				onEditLast={handleEditLast}
			/>

			<ChatComposer
				input={input}
				onChange={setInput}
				onSend={handleSend}
				onStop={handleStop}
				isStreaming={state.status === "streaming"}
			/>
		</div>
	);
}
