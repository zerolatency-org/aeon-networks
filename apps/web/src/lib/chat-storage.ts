// apps/web/src/lib/chat-storage.ts
import type { ChatMessage, ChatUsage } from "./chat-reducer";

export type ChatThread = {
	id: string;
	agentId: string;
	agentName: string;
	avatarKind?: string | null;
	avatarRef?: unknown;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: ChatMessage[];
	totalUsage?: ChatUsage;
};

const STORAGE_KEY = "aeon_chat_threads_v1";

export function loadThreads(): ChatThread[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return (JSON.parse(raw) as ChatThread[]).sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		);
	} catch {
		return [];
	}
}

export function saveThread(thread: ChatThread): void {
	if (typeof window === "undefined") return;
	try {
		const existing = loadThreads().filter((t) => t.id !== thread.id);
		existing.unshift(thread);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
	} catch {
		// Ignore storage errors
	}
}

export function getThread(id: string): ChatThread | null {
	const threads = loadThreads();
	return threads.find((t) => t.id === id) ?? null;
}

export function deleteThread(id: string): void {
	if (typeof window === "undefined") return;
	try {
		const threads = loadThreads().filter((t) => t.id !== id);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
	} catch {
		// Ignore storage errors
	}
}

export function searchThreadMessages(
	thread: ChatThread,
	query: string,
): ChatMessage[] {
	const q = query.trim().toLowerCase();
	if (!q) return thread.messages;
	return thread.messages.filter((m) => m.content.toLowerCase().includes(q));
}
