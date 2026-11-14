// apps/web/src/components/chat/chat-composer.tsx
"use client";

import { type KeyboardEvent, useRef } from "react";

export function ChatComposer({
	input,
	onChange,
	onSend,
	onStop,
	isStreaming,
	disabled = false,
}: {
	input: string;
	onChange: (val: string) => void;
	onSend: () => void;
	onStop: () => void;
	isStreaming: boolean;
	disabled?: boolean;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (!isStreaming && input.trim()) {
				onSend();
			}
		}
	};

	const canSend = !disabled && !isStreaming && input.trim().length > 0;

	return (
		<div className="glass border-border/80 fixed inset-x-4 bottom-4 mx-auto max-w-3xl rounded-2xl border p-2 shadow-lg sm:inset-x-6 sm:bottom-6">
			<div className="relative flex items-end gap-2">
				<textarea
					ref={textareaRef}
					rows={1}
					value={input}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					placeholder="Message your agent... (Enter to send, Shift+Enter for new line)"
					className="text-fg placeholder:text-fg-3 max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm focus:outline-hidden"
				/>

				{isStreaming ? (
					<button
						type="button"
						onClick={onStop}
						className="bg-ember/15 text-ember hover:bg-ember/25 border-ember/30 flex h-9 shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors"
					>
						Stop
					</button>
				) : (
					<button
						type="button"
						disabled={!canSend}
						onClick={onSend}
						className={`flex h-9 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-semibold transition-all ${
							canSend
								? "bg-lumen text-fg-inverse shadow-xs hover:opacity-90 active:scale-95"
								: "bg-surface-2 text-fg-3 cursor-not-allowed"
						}`}
					>
						Send
					</button>
				)}
			</div>
		</div>
	);
}
