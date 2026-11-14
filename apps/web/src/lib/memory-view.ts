// apps/web/src/lib/memory-view.ts

export type MemoryType = "task_archive" | "learned_fact" | "context_blob";

export type MemoryItem = {
	id: string;
	agentId: string;
	type: MemoryType;
	title: string;
	summary: string;
	createdAt: string;
	sizeBytes: number;
	ogRootHash?: string;
};

export function filterMemoryItems(
	items: MemoryItem[],
	query: string,
): MemoryItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	return items.filter(
		(m) =>
			m.title.toLowerCase().includes(q) ||
			m.summary.toLowerCase().includes(q) ||
			m.type.toLowerCase().includes(q),
	);
}

export function deleteMemoryItem(
	items: MemoryItem[],
	id: string,
): MemoryItem[] {
	return items.filter((m) => m.id !== id);
}

export function formatMemorySize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SEALED_MARKERS = [
	/persona instruction:?[^\n.]*/gi,
	/master_key[^\s.]*/gi,
	/secret_key[^\s.]*/gi,
	/private_key[^\s.]*/gi,
];

export function sanitizeMemoryContent(content: string): string {
	let sanitized = content;
	for (const pattern of SEALED_MARKERS) {
		sanitized = sanitized.replace(pattern, "[SEALED]");
	}
	return sanitized;
}
