// apps/web/src/lib/message-view.ts
import type { ToolCall } from "./chat-reducer";

export type RenderBlock =
	| { type: "text"; content: string }
	| { type: "code"; language: string; code: string }
	| {
			type: "tool";
			toolCallId: string;
			toolName: string;
			args: unknown;
			result?: unknown;
	  };

export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function isSafeUrl(url: string): boolean {
	const trimmed = url.trim().toLowerCase();
	return trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

export function parseMessageBlocks(
	content: string,
	toolCalls?: ToolCall[],
): RenderBlock[] {
	const blocks: RenderBlock[] = [];
	const codeFenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g;

	let lastIndex = 0;
	let match = codeFenceRegex.exec(content);

	while (match !== null) {
		const matchStart = match.index;
		const matchEnd = matchStart + match[0].length;

		// Text preceding the code fence
		if (matchStart > lastIndex) {
			const text = content.slice(lastIndex, matchStart).trim();
			if (text) {
				blocks.push({ type: "text", content: text });
			}
		}

		// The code block itself
		const language = (match[1] ?? "").trim();
		const code = (match[2] ?? "").replace(/\n$/, "");
		blocks.push({ type: "code", language, code });

		lastIndex = matchEnd;
		match = codeFenceRegex.exec(content);
	}

	// Any trailing text after the last code block
	if (lastIndex < content.length) {
		const remaining = content.slice(lastIndex).trim();
		if (remaining) {
			blocks.push({ type: "text", content: remaining });
		}
	}

	// Append any tool calls associated with the message
	if (toolCalls && toolCalls.length > 0) {
		for (const tc of toolCalls) {
			blocks.push({
				type: "tool",
				toolCallId: tc.toolCallId,
				toolName: tc.toolName,
				args: tc.args,
				result: tc.result,
			});
		}
	}

	return blocks;
}
