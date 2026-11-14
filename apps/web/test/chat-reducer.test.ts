// apps/web/test/chat-reducer.test.ts
import { describe, expect, test } from "bun:test";
import {
	type ChatState,
	chatReducer,
	initialChatState,
} from "@/lib/chat-reducer";

describe("Conversation reducer", () => {
	test("initial state is idle with empty messages and no usage", () => {
		expect(initialChatState.status).toBe("idle");
		expect(initialChatState.messages).toEqual([]);
		expect(initialChatState.usage).toBeNull();
		expect(initialChatState.error).toBeNull();
	});

	test("send action appends user message and initializes assistant placeholder", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_user_1",
			assistantId: "m_asst_1",
			content: "Explain consensus",
		});

		expect(s1.status).toBe("streaming");
		expect(s1.messages.length).toBe(2);
		expect(s1.messages[0]).toEqual({
			id: "m_user_1",
			role: "user",
			content: "Explain consensus",
			createdAt: s1.messages[0]?.createdAt ?? "",
		});
		expect(s1.messages[1]).toEqual({
			id: "m_asst_1",
			role: "assistant",
			content: "",
			createdAt: s1.messages[1]?.createdAt ?? "",
		});
	});

	test("send action ignores empty or whitespace-only content", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "   ",
		});
		expect(s1).toEqual(initialChatState);
	});

	test("no duplicate sends while already streaming", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "First",
		});
		const s2 = chatReducer(s1, {
			type: "send",
			id: "m_3",
			assistantId: "m_4",
			content: "Second",
		});
		expect(s2.messages.length).toBe(2); // didn't add duplicate
		expect(s2.messages[0]?.content).toBe("First");
	});

	test("text_chunk action appends text incrementally to assistant message", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, { type: "text_chunk", text: "Hello " });
		const s3 = chatReducer(s2, { type: "text_chunk", text: "there!" });

		expect(s3.messages[1]?.content).toBe("Hello there!");
	});

	test("tool_call action adds tool call chip to assistant message", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Balance?",
		});
		const s2 = chatReducer(s1, {
			type: "tool_call",
			toolCallId: "call_99",
			toolName: "wallet_balance",
			args: {},
		});

		expect(s2.messages[1]?.toolCalls?.length).toBe(1);
		expect(s2.messages[1]?.toolCalls?.[0]?.toolName).toBe("wallet_balance");
	});

	test("tool_result action updates corresponding tool call", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Balance?",
		});
		const s2 = chatReducer(s1, {
			type: "tool_call",
			toolCallId: "call_99",
			toolName: "wallet_balance",
			args: {},
		});
		const s3 = chatReducer(s2, {
			type: "tool_result",
			toolCallId: "call_99",
			result: { balanceWei: "100" },
		});

		expect(s3.messages[1]?.toolCalls?.[0]?.result).toEqual({
			balanceWei: "100",
		});
	});

	test("finish action sets status to idle and records usage", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, { type: "text_chunk", text: "Done" });
		const s3 = chatReducer(s2, {
			type: "finish",
			usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
		});

		expect(s3.status).toBe("idle");
		expect(s3.usage).toEqual({
			promptTokens: 50,
			completionTokens: 20,
			totalTokens: 70,
		});
		expect(s3.activeAssistantId).toBeNull();
	});

	test("error action sets error state and stops streaming", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, {
			type: "error",
			message: "Connection lost",
		});

		expect(s2.status).toBe("error");
		expect(s2.error).toBe("Connection lost");
		expect(s2.messages[1]?.error).toBe("Connection lost");
	});

	test("stop action preserves partial text and marks idle", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, {
			type: "text_chunk",
			text: "Partial thought...",
		});
		const s3 = chatReducer(s2, { type: "stop" });

		expect(s3.status).toBe("idle");
		expect(s3.messages[1]?.content).toBe("Partial thought...");
		expect(s3.activeAssistantId).toBeNull();
	});

	test("retry action removes failed assistant reply and creates fresh assistant turn", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, { type: "error", message: "Failed" });
		const s3 = chatReducer(s2, { type: "retry", newAssistantId: "m_3" });

		expect(s3.status).toBe("streaming");
		expect(s3.error).toBeNull();
		expect(s3.messages.length).toBe(2);
		expect(s3.messages[0]?.content).toBe("Hi");
		expect(s3.messages[1]?.id).toBe("m_3");
		expect(s3.messages[1]?.content).toBe("");
	});

	test("retry action does nothing if there is no user message to retry", () => {
		const s1 = chatReducer(initialChatState, {
			type: "retry",
			newAssistantId: "m_1",
		});
		expect(s1).toEqual(initialChatState);
	});

	test("edit_last action updates last user prompt and resets assistant reply", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Initial prompt",
		});
		const s2 = chatReducer(s1, { type: "text_chunk", text: "Initial answer" });
		const s3 = chatReducer(s2, {
			type: "edit_last",
			content: "Edited prompt",
			newAssistantId: "m_3",
		});

		expect(s3.status).toBe("streaming");
		expect(s3.messages.length).toBe(2);
		expect(s3.messages[0]?.content).toBe("Edited prompt");
		expect(s3.messages[1]?.id).toBe("m_3");
		expect(s3.messages[1]?.content).toBe("");
	});

	test("clear action resets messages and state to empty", () => {
		const s1 = chatReducer(initialChatState, {
			type: "send",
			id: "m_1",
			assistantId: "m_2",
			content: "Hi",
		});
		const s2 = chatReducer(s1, { type: "clear" });
		expect(s2).toEqual(initialChatState);
	});
});
