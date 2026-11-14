// apps/web/test/chat-stream.test.ts
import { describe, expect, test } from "bun:test";
import { createStreamParser, type StreamEvent } from "@/lib/chat-stream";

describe("Chat stream parser", () => {
	test('parses standard text chunks (0:"hello")', () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('0:"Hello "\n0:"world"\n', (e) => events.push(e));

		expect(events).toEqual([
			{ type: "text", text: "Hello " },
			{ type: "text", text: "world" },
		]);
	});

	test("survives chunks split across chunk boundaries", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];

		parser.feed('0:"Hel', (e) => events.push(e));
		expect(events.length).toBe(0);

		parser.feed('lo"\n', (e) => events.push(e));
		expect(events).toEqual([{ type: "text", text: "Hello" }]);
	});

	test("parses tool call chunks (9:{...})", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		const toolPayload = JSON.stringify({
			toolCallId: "call_123",
			toolName: "wallet_balance",
			args: {},
		});
		parser.feed(`9:${toolPayload}\n`, (e) => events.push(e));

		expect(events).toEqual([
			{
				type: "tool_call",
				toolCallId: "call_123",
				toolName: "wallet_balance",
				args: {},
			},
		]);
	});

	test("parses tool result chunks (a:{...})", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		const resPayload = JSON.stringify({
			toolCallId: "call_123",
			result: { balance: "1000000000000000" },
		});
		parser.feed(`a:${resPayload}\n`, (e) => events.push(e));

		expect(events).toEqual([
			{
				type: "tool_result",
				toolCallId: "call_123",
				result: { balance: "1000000000000000" },
			},
		]);
	});

	test("parses final usage and finish data (d:{...})", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		const finishPayload = JSON.stringify({
			finishReason: "stop",
			usage: { promptTokens: 120, completionTokens: 45 },
		});
		parser.feed(`d:${finishPayload}\n`, (e) => events.push(e));

		expect(events).toEqual([
			{
				type: "finish",
				finishReason: "stop",
				usage: { promptTokens: 120, completionTokens: 45, totalTokens: 165 },
			},
		]);
	});

	test('parses error events (e:{...} or 3:"error")', () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('3:"Model overloaded"\n', (e) => events.push(e));

		expect(events).toEqual([{ type: "error", error: "Model overloaded" }]);
	});

	test("ignores blank lines and unrecognized lines without throwing", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('\n\nunknown:prefix\n0:"ok"\n\n', (e) => events.push(e));

		expect(events).toEqual([{ type: "text", text: "ok" }]);
	});

	test("flushes remaining buffer on end", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('0:"trailing text"', (e) => events.push(e));
		expect(events.length).toBe(0);

		parser.end((e) => events.push(e));
		expect(events).toEqual([{ type: "text", text: "trailing text" }]);
	});

	test("handles escaped quotes and newlines inside text string", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('0:"Line 1\\nLine 2 with \\"quotes\\""\n', (e) =>
			events.push(e),
		);

		expect(events).toEqual([
			{ type: "text", text: 'Line 1\nLine 2 with "quotes"' },
		]);
	});

	test("parses standard SSE data: prefix lines gracefully", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('data: {"text":"hello from sse"}\n\n', (e) => events.push(e));

		expect(events).toEqual([{ type: "text", text: "hello from sse" }]);
	});

	test("survives malformed JSON in chunk without crashing stream", () => {
		const parser = createStreamParser();
		const events: StreamEvent[] = [];
		parser.feed('9:{malformed_json}\n0:"recovered"\n', (e) => events.push(e));

		expect(events).toEqual([{ type: "text", text: "recovered" }]);
	});

	test("accumulates complete multi-paragraph output seamlessly", () => {
		const parser = createStreamParser();
		let accumulated = "";
		parser.feed('0:"Paragraph 1\\n\\n"\n0:"Paragraph 2"\n', (e) => {
			if (e.type === "text") accumulated += e.text;
		});

		expect(accumulated).toBe("Paragraph 1\n\nParagraph 2");
	});
});
