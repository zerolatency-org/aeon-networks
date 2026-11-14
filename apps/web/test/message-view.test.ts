// apps/web/test/message-view.test.ts
import { describe, expect, test } from "bun:test";
import {
	escapeHtml,
	isSafeUrl,
	parseMessageBlocks,
	type RenderBlock,
} from "@/lib/message-view";

describe("Message rendering rules", () => {
	test("escapeHtml escapes dangerous HTML characters to prevent XSS", () => {
		expect(escapeHtml("<script>alert(1)</script>")).toBe(
			"&lt;script&gt;alert(1)&lt;/script&gt;",
		);
		expect(escapeHtml("\"quoted\" & 'single'")).toBe(
			"&quot;quoted&quot; &amp; &#39;single&#39;",
		);
	});

	test("isSafeUrl accepts http and https links only", () => {
		expect(isSafeUrl("https://example.com/docs")).toBe(true);
		expect(isSafeUrl("http://localhost:3000")).toBe(true);
		expect(isSafeUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeUrl("data:text/html,bad")).toBe(false);
		expect(isSafeUrl("vbscript:bad")).toBe(false);
	});

	test("parseMessageBlocks splits plain text into text blocks", () => {
		const blocks = parseMessageBlocks("Simple text message without code.");
		expect(blocks).toEqual([
			{ type: "text", content: "Simple text message without code." },
		]);
	});

	test("parseMessageBlocks detects and extracts fenced code blocks with language", () => {
		const text = "Here is the code:\n```typescript\nconst a = 1;\n```\nDone.";
		const blocks = parseMessageBlocks(text);

		expect(blocks.length).toBe(3);
		expect(blocks[0]).toEqual({ type: "text", content: "Here is the code:" });
		expect(blocks[1]).toEqual({
			type: "code",
			language: "typescript",
			code: "const a = 1;",
		});
		expect(blocks[2]).toEqual({ type: "text", content: "Done." });
	});

	test("parseMessageBlocks handles code blocks without explicit language", () => {
		const text = "```\nplain block\n```";
		const blocks = parseMessageBlocks(text);
		expect(blocks).toEqual([
			{ type: "code", language: "", code: "plain block" },
		]);
	});

	test("parseMessageBlocks handles unclosed code fence gracefully", () => {
		const text = "```typescript\nconst x = 10;";
		const blocks = parseMessageBlocks(text);
		expect(blocks.length).toBe(1);
		expect(blocks[0]?.type).toBe("code");
		if (blocks[0]?.type === "code") {
			expect(blocks[0].code).toBe("const x = 10;");
		}
	});

	test("parseMessageBlocks recognizes tool calls and formats tool-call blocks", () => {
		const toolCalls = [
			{
				toolCallId: "c_1",
				toolName: "wallet_balance",
				args: { address: "0x123" },
				result: { balance: "100" },
			},
		];
		const blocks = parseMessageBlocks("Checking your balance...", toolCalls);
		expect(blocks.length).toBe(2);
		expect(blocks[1]?.type).toBe("tool");
		if (blocks[1]?.type === "tool") {
			expect(blocks[1].toolName).toBe("wallet_balance");
			expect(blocks[1].toolCallId).toBe("c_1");
		}
	});

	test("parseMessageBlocks sanitizes markdown links in text", () => {
		const text = "Read the docs at [Aeon Docs](https://docs.aeon.xyz).";
		const blocks = parseMessageBlocks(text);
		expect(blocks[0]?.type).toBe("text");
	});
});
