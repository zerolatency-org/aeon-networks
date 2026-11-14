// apps/web/src/lib/chat-reducer.ts

export type ToolCall = {
	toolCallId: string;
	toolName: string;
	args: unknown;
	result?: unknown;
};

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
	toolCalls?: ToolCall[];
	error?: string;
};

export type ChatUsage = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

export type ChatState = {
	messages: ChatMessage[];
	status: "idle" | "streaming" | "error";
	error: string | null;
	usage: ChatUsage | null;
	activeAssistantId: string | null;
};

export const initialChatState: ChatState = {
	messages: [],
	status: "idle",
	error: null,
	usage: null,
	activeAssistantId: null,
};

export type ChatAction =
	| { type: "send"; id: string; assistantId: string; content: string }
	| { type: "text_chunk"; text: string }
	| { type: "tool_call"; toolCallId: string; toolName: string; args: unknown }
	| { type: "tool_result"; toolCallId: string; result: unknown }
	| { type: "finish"; usage?: ChatUsage }
	| { type: "error"; message: string }
	| { type: "stop" }
	| { type: "retry"; newAssistantId: string }
	| { type: "edit_last"; content: string; newAssistantId: string }
	| { type: "clear" };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
	switch (action.type) {
		case "send": {
			const trimmed = action.content.trim();
			if (!trimmed || state.status === "streaming") {
				return state;
			}
			const now = new Date().toISOString();
			const userMsg: ChatMessage = {
				id: action.id,
				role: "user",
				content: trimmed,
				createdAt: now,
			};
			const asstMsg: ChatMessage = {
				id: action.assistantId,
				role: "assistant",
				content: "",
				createdAt: now,
			};
			return {
				...state,
				status: "streaming",
				error: null,
				messages: [...state.messages, userMsg, asstMsg],
				activeAssistantId: action.assistantId,
			};
		}

		case "text_chunk": {
			if (!state.activeAssistantId) return state;
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === state.activeAssistantId
						? { ...m, content: m.content + action.text }
						: m,
				),
			};
		}

		case "tool_call": {
			if (!state.activeAssistantId) return state;
			return {
				...state,
				messages: state.messages.map((m) => {
					if (m.id !== state.activeAssistantId) return m;
					const toolCalls = m.toolCalls ? [...m.toolCalls] : [];
					toolCalls.push({
						toolCallId: action.toolCallId,
						toolName: action.toolName,
						args: action.args,
					});
					return { ...m, toolCalls };
				}),
			};
		}

		case "tool_result": {
			if (!state.activeAssistantId) return state;
			return {
				...state,
				messages: state.messages.map((m) => {
					if (m.id !== state.activeAssistantId || !m.toolCalls) return m;
					return {
						...m,
						toolCalls: m.toolCalls.map((tc) =>
							tc.toolCallId === action.toolCallId
								? { ...tc, result: action.result }
								: tc,
						),
					};
				}),
			};
		}

		case "finish": {
			return {
				...state,
				status: "idle",
				usage: action.usage ?? state.usage,
				activeAssistantId: null,
			};
		}

		case "error": {
			return {
				...state,
				status: "error",
				error: action.message,
				messages: state.messages.map((m) =>
					m.id === state.activeAssistantId
						? { ...m, error: action.message }
						: m,
				),
				activeAssistantId: null,
			};
		}

		case "stop": {
			return {
				...state,
				status: "idle",
				activeAssistantId: null,
			};
		}

		case "retry": {
			// Find the last user message
			const lastUserIdx = state.messages.findLastIndex(
				(m) => m.role === "user",
			);
			if (lastUserIdx === -1) return state;

			const userMessage = state.messages[lastUserIdx];
			if (!userMessage) return state;

			// Keep messages up to that user message and append fresh assistant message
			const preserved = state.messages.slice(0, lastUserIdx + 1);
			const newAssistant: ChatMessage = {
				id: action.newAssistantId,
				role: "assistant",
				content: "",
				createdAt: new Date().toISOString(),
			};

			return {
				...state,
				status: "streaming",
				error: null,
				messages: [...preserved, newAssistant],
				activeAssistantId: action.newAssistantId,
			};
		}

		case "edit_last": {
			const lastUserIdx = state.messages.findLastIndex(
				(m) => m.role === "user",
			);
			if (lastUserIdx === -1) return state;

			const trimmed = action.content.trim();
			if (!trimmed) return state;

			const targetUser = state.messages[lastUserIdx];
			if (!targetUser) return state;

			const preserved = state.messages.slice(0, lastUserIdx);
			const updatedUser: ChatMessage = {
				...targetUser,
				content: trimmed,
			};
			const newAssistant: ChatMessage = {
				id: action.newAssistantId,
				role: "assistant",
				content: "",
				createdAt: new Date().toISOString(),
			};

			return {
				...state,
				status: "streaming",
				error: null,
				messages: [...preserved, updatedUser, newAssistant],
				activeAssistantId: action.newAssistantId,
			};
		}

		case "clear": {
			return initialChatState;
		}

		default:
			return state;
	}
}
