// apps/web/src/components/chat/chat-messages.tsx
"use client";

import { useEffect, useRef } from "react";

import { AgentFace } from "@/components/agents/agent-face";
import type { AvatarChoice } from "@/lib/agents-parse";
import { avatarTint } from "@/lib/avatar";
import {
	calculateChatCost,
	costReadoutText,
	type ModelPricing,
} from "@/lib/chat-cost";
import type { ChatMessage, ChatUsage } from "@/lib/chat-reducer";
import { parseMessageBlocks } from "@/lib/message-view";

export function ChatMessages({
	messages,
	agentId,
	agentName,
	face,
	isStreaming,
	modelPricing,
	latestUsage,
	onRetry,
	onEditLast,
}: {
	messages: ChatMessage[];
	agentId: string;
	agentName: string;
	face?: AvatarChoice | null;
	isStreaming: boolean;
	modelPricing?: ModelPricing | null;
	latestUsage?: ChatUsage | null;
	onRetry?: () => void;
	onEditLast?: (newPrompt: string) => void;
}) {
	const bottomRef = useRef<HTMLDivElement>(null);

	// Scroll anchoring to keep conversation in view
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each message change
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, messages[messages.length - 1]?.content]);

	const agentFace: AvatarChoice = face ?? {
		kind: "dicebear" as const,
		seed: agentId,
		bg: avatarTint(agentId),
	};

	const lastUserIdx = messages.findLastIndex((m) => m.role === "user");

	return (
		<div className="space-y-6 pb-28">
			{messages.length === 0 && (
				<div className="border-border bg-surface-1 rounded-2xl border p-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center">
						<AgentFace face={agentFace} size={54} />
					</div>
					<h3 className="mt-3 font-serif text-lg font-medium">
						Chat with {agentName}
					</h3>
					<p className="text-fg-2 mx-auto mt-1 max-w-sm text-xs">
						Direct, encrypted conversation. Model inference is executed through
						0G verified node workers.
					</p>
				</div>
			)}

			{messages.map((msg, idx) => {
				const isUser = msg.role === "user";
				const isLastAssistant = !isUser && idx === messages.length - 1;
				const blocks = parseMessageBlocks(msg.content, msg.toolCalls);

				return (
					<div
						key={msg.id}
						className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
					>
						{!isUser && (
							<div className="shrink-0 pt-0.5">
								<AgentFace face={agentFace} size={32} />
							</div>
						)}

						<div
							className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] ${
								isUser
									? "bg-surface-2 text-fg rounded-br-xs"
									: "bg-surface-1 border-border rounded-bl-xs border shadow-xs"
							}`}
						>
							{/* Message Blocks */}
							<div className="space-y-3">
								{blocks.map((block, bIdx) => {
									if (block.type === "code") {
										return (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: blocks within message
												key={bIdx}
												className="bg-surface-3/80 border-border/80 my-2 overflow-hidden rounded-xl border text-xs"
											>
												{block.language && (
													<div className="border-border/60 text-fg-3 flex items-center justify-between border-b px-3 py-1 font-mono text-[10px] uppercase">
														<span>{block.language}</span>
													</div>
												)}
												<pre className="overflow-x-auto p-3 font-mono leading-relaxed">
													<code>{block.code}</code>
												</pre>
											</div>
										);
									}

									if (block.type === "tool") {
										return (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: blocks within message
												key={bIdx}
												className="border-border bg-surface-2/60 my-1 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-xs"
											>
												<span className="text-lumen font-bold">⚡</span>
												<span className="text-fg font-medium">
													{block.toolName}
												</span>
												{block.result !== undefined && (
													<span className="text-moss text-[10px]">
														✓ completed
													</span>
												)}
											</div>
										);
									}

									return (
										<p
											// biome-ignore lint/suspicious/noArrayIndexKey: blocks within message
											key={bIdx}
											className="leading-relaxed whitespace-pre-wrap"
										>
											{block.content}
										</p>
									);
								})}

								{msg.content === "" && !isUser && isStreaming && (
									<div className="text-fg-3 flex items-center gap-1.5 py-1">
										<span className="bg-lumen h-1.5 w-1.5 animate-pulse rounded-full" />
										<span className="bg-lumen h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:200ms]" />
										<span className="bg-lumen h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:400ms]" />
									</div>
								)}

								{msg.error && (
									<p className="text-ember text-xs font-medium">
										Error: {msg.error}
									</p>
								)}
							</div>

							{/* Cost readout on last assistant message */}
							{isLastAssistant && latestUsage && (
								<div className="text-fg-3 border-border/60 mt-2 border-t pt-1.5 text-right font-mono text-[11px]">
									{costReadoutText(
										calculateChatCost(
											modelPricing ?? null,
											latestUsage.promptTokens,
											latestUsage.completionTokens,
										),
										latestUsage.totalTokens,
									)}
								</div>
							)}

							{/* Actions on last turns */}
							{isUser && idx === lastUserIdx && onEditLast && !isStreaming && (
								<div className="mt-1 text-right">
									<button
										type="button"
										onClick={() => {
											const next = prompt("Edit message:", msg.content);
											if (next && next.trim()) onEditLast(next.trim());
										}}
										className="text-fg-3 hover:text-fg text-[11px] underline"
									>
										edit
									</button>
								</div>
							)}

							{isLastAssistant && msg.error && onRetry && !isStreaming && (
								<div className="mt-2 text-right">
									<button
										type="button"
										onClick={onRetry}
										className="bg-surface-2 text-fg hover:bg-surface-3 rounded-lg px-2.5 py-1 text-xs font-medium"
									>
										Retry reply
									</button>
								</div>
							)}
						</div>
					</div>
				);
			})}

			<div ref={bottomRef} />
		</div>
	);
}
