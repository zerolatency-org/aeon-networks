// apps/web/src/lib/chat-stream.ts

export type StreamTextEvent = {
	type: "text";
	text: string;
};

export type StreamToolCallEvent = {
	type: "tool_call";
	toolCallId: string;
	toolName: string;
	args: unknown;
};

export type StreamToolResultEvent = {
	type: "tool_result";
	toolCallId: string;
	result: unknown;
};

export type StreamFinishEvent = {
	type: "finish";
	finishReason: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
};

export type StreamErrorEvent = {
	type: "error";
	error: string;
};

export type StreamEvent =
	| StreamTextEvent
	| StreamToolCallEvent
	| StreamToolResultEvent
	| StreamFinishEvent
	| StreamErrorEvent;

export function parseStreamLine(line: string): StreamEvent | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	// AI SDK UI message stream protocol:
	// 0:"text"
	if (trimmed.startsWith('0:"') && trimmed.endsWith('"')) {
		try {
			const text = JSON.parse(trimmed.slice(2));
			return { type: "text", text };
		} catch {
			return null;
		}
	}

	// 9:{"toolCallId":..., "toolName":..., "args":...}
	if (trimmed.startsWith("9:")) {
		try {
			const data = JSON.parse(trimmed.slice(2));
			return {
				type: "tool_call",
				toolCallId: data.toolCallId,
				toolName: data.toolName,
				args: data.args,
			};
		} catch {
			return null;
		}
	}

	// a:{"toolCallId":..., "result":...}
	if (trimmed.startsWith("a:")) {
		try {
			const data = JSON.parse(trimmed.slice(2));
			return {
				type: "tool_result",
				toolCallId: data.toolCallId,
				result: data.result,
			};
		} catch {
			return null;
		}
	}

	// d:{"finishReason":..., "usage":...}
	if (trimmed.startsWith("d:")) {
		try {
			const data = JSON.parse(trimmed.slice(2));
			const p = Number(data.usage?.promptTokens ?? 0);
			const c = Number(data.usage?.completionTokens ?? 0);
			return {
				type: "finish",
				finishReason: String(data.finishReason ?? "stop"),
				usage: {
					promptTokens: p,
					completionTokens: c,
					totalTokens: p + c,
				},
			};
		} catch {
			return null;
		}
	}

	// 3:"error" or e:{...}
	if (trimmed.startsWith('3:"') && trimmed.endsWith('"')) {
		try {
			const error = JSON.parse(trimmed.slice(2));
			return { type: "error", error };
		} catch {
			return null;
		}
	}
	if (trimmed.startsWith("e:")) {
		try {
			const data = JSON.parse(trimmed.slice(2));
			return { type: "error", error: data.message || "Chat error" };
		} catch {
			return null;
		}
	}

	// Standard SSE: data: {"text": "..."}
	if (trimmed.startsWith("data:")) {
		const payload = trimmed.slice(5).trim();
		if (!payload || payload === "[DONE]") return null;
		try {
			const data = JSON.parse(payload);
			if (typeof data.text === "string") {
				return { type: "text", text: data.text };
			}
		} catch {
			return null;
		}
	}

	return null;
}

export function createStreamParser() {
	let buffer = "";

	return {
		feed(chunk: string, onEvent: (e: StreamEvent) => void) {
			buffer += chunk;
			const lines = buffer.split("\n");
			// Keep the last partial line in the buffer
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const event = parseStreamLine(line);
				if (event) {
					onEvent(event);
				}
			}
		},
		end(onEvent?: (e: StreamEvent) => void) {
			if (buffer.trim()) {
				const event = parseStreamLine(buffer);
				if (event && onEvent) {
					onEvent(event);
				}
			}
			buffer = "";
		},
	};
}
