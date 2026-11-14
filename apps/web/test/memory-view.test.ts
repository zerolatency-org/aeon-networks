// apps/web/test/memory-view.test.ts
import { describe, expect, test } from "bun:test";
import {
	deleteMemoryItem,
	filterMemoryItems,
	formatMemorySize,
	type MemoryItem,
	sanitizeMemoryContent,
} from "@/lib/memory-view";

const mockMemories: MemoryItem[] = [
	{
		id: "mem_1",
		agentId: "ag_1",
		type: "task_archive",
		title: "Quarterly Financial Analysis",
		summary: "Extracted table of revenues and operating expenses for Q3.",
		createdAt: "2026-11-14T10:00:00Z",
		sizeBytes: 15400,
	},
	{
		id: "mem_2",
		agentId: "ag_1",
		type: "learned_fact",
		title: "Client Formatting Preference",
		summary: "Client prefers executive summaries in bulleted markdown format.",
		createdAt: "2026-11-13T12:00:00Z",
		sizeBytes: 320,
	},
	{
		id: "mem_3",
		agentId: "ag_1",
		type: "context_blob",
		title: "Ethereum Contract Verification Spec",
		summary: "ERC-20 token ABI specification and standard method signatures.",
		createdAt: "2026-11-12T08:00:00Z",
		sizeBytes: 120500,
	},
];

describe("Agent memory management", () => {
	test("filterMemoryItems returns all items when search query is empty", () => {
		const filtered = filterMemoryItems(mockMemories, "");
		expect(filtered.length).toBe(3);
	});

	test("filterMemoryItems filters by title keyword", () => {
		const filtered = filterMemoryItems(mockMemories, "financial");
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.id).toBe("mem_1");
	});

	test("filterMemoryItems filters by summary content", () => {
		const filtered = filterMemoryItems(mockMemories, "bulleted");
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.id).toBe("mem_2");
	});

	test("deleteMemoryItem removes item by id immutably", () => {
		const updated = deleteMemoryItem(mockMemories, "mem_2");
		expect(updated.length).toBe(2);
		expect(updated.some((m) => m.id === "mem_2")).toBe(false);
		expect(mockMemories.length).toBe(3); // untouched
	});

	test("deleteMemoryItem ignores non-existent id gracefully", () => {
		const updated = deleteMemoryItem(mockMemories, "non_existent");
		expect(updated.length).toBe(3);
	});

	test("formatMemorySize formats bytes, KB, and MB accurately", () => {
		expect(formatMemorySize(500)).toBe("500 B");
		expect(formatMemorySize(15400)).toBe("15.0 KB");
		expect(formatMemorySize(1048576)).toBe("1.0 MB");
	});

	test("sanitizeMemoryContent blocks and strips sealed persona markers", () => {
		const raw = "Persona instruction: NEVER_REVEAL_SECRET_KEY. Task completed.";
		const sanitized = sanitizeMemoryContent(raw);
		expect(sanitized).not.toContain("NEVER_REVEAL_SECRET_KEY");
		expect(sanitized).toContain("[SEALED]");
	});

	test("sanitizeMemoryContent preserves ordinary text safe from leak", () => {
		const safe = "Completed market research on decentralized AI architectures.";
		expect(sanitizeMemoryContent(safe)).toBe(safe);
	});
});
