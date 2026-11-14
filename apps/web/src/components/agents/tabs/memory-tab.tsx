// apps/web/src/components/agents/tabs/memory-tab.tsx
"use client";

import { useState } from "react";
import {
	deleteMemoryItem,
	filterMemoryItems,
	formatMemorySize,
	type MemoryItem,
	sanitizeMemoryContent,
} from "@/lib/memory-view";
import { card, field, hint, primary, quiet } from "../styles";

const INITIAL_MEMORIES: MemoryItem[] = [
	{
		id: "mem_1",
		agentId: "default",
		type: "task_archive",
		title: "Autonomous Web Search Policy",
		summary: "Guidelines on trusted scholarly sources and citation formats.",
		createdAt: "2026-11-12T10:00:00Z",
		sizeBytes: 1240,
	},
	{
		id: "mem_2",
		agentId: "default",
		type: "learned_fact",
		title: "Zero-Knowledge Escrow Guarantees",
		summary: "Cached verification proofs and execution commitments on 0G.",
		createdAt: "2026-11-13T14:30:00Z",
		sizeBytes: 8500,
	},
];

export function MemoryTab() {
	const [memories, setMemories] = useState<MemoryItem[]>(INITIAL_MEMORIES);
	const [searchQuery, setSearchQuery] = useState("");
	const [newTitle, setNewTitle] = useState("");
	const [newSummary, setNewSummary] = useState("");
	const [isAdding, setIsAdding] = useState(false);

	const filtered = filterMemoryItems(memories, searchQuery);

	const handleDelete = (id: string) => {
		if (confirm("Permanently delete this memory item?")) {
			setMemories((prev) => deleteMemoryItem(prev, id));
		}
	};

	const handleAdd = () => {
		if (!newTitle.trim() || !newSummary.trim()) return;
		const newItem: MemoryItem = {
			id: `mem_${Date.now()}`,
			agentId: "default",
			type: "context_blob",
			title: newTitle.trim(),
			summary: sanitizeMemoryContent(newSummary.trim()),
			createdAt: new Date().toISOString(),
			sizeBytes: newSummary.length,
		};
		setMemories((prev) => [newItem, ...prev]);
		setNewTitle("");
		setNewSummary("");
		setIsAdding(false);
	};

	return (
		<div className="space-y-6">
			<div className={card}>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="font-serif text-2xl">Agent memory</h2>
						<p className={`${hint} mt-1`}>
							Contextual facts, learned guidelines, and execution archives.
							Persona keys remain sealed in hardware vaults.
						</p>
					</div>
					<button
						type="button"
						onClick={() => setIsAdding(!isAdding)}
						className={quiet}
					>
						{isAdding ? "Cancel" : "+ Add context fact"}
					</button>
				</div>

				{/* Add memory form */}
				{isAdding && (
					<div className="bg-surface-2 border-border my-6 space-y-3 rounded-xl border p-4">
						<h3 className="text-sm font-semibold">Store new guideline</h3>
						<div>
							<label
								htmlFor="mem-title"
								className="mb-1 block text-xs font-medium"
							>
								Title
							</label>
							<input
								id="mem-title"
								className={field}
								value={newTitle}
								onChange={(e) => setNewTitle(e.target.value)}
								placeholder="e.g. Markdown output standards"
							/>
						</div>
						<div>
							<label
								htmlFor="mem-summary"
								className="mb-1 block text-xs font-medium"
							>
								Fact / Guideline Context
							</label>
							<textarea
								id="mem-summary"
								rows={3}
								className={field}
								value={newSummary}
								onChange={(e) => setNewSummary(e.target.value)}
								placeholder="Agent will reference this guideline during job runs..."
							/>
						</div>
						<button
							type="button"
							onClick={handleAdd}
							disabled={!newTitle.trim() || !newSummary.trim()}
							className={primary}
						>
							Save to memory
						</button>
					</div>
				)}

				{/* Search bar */}
				<div className="mt-6">
					<input
						type="search"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search agent memories and guidelines..."
						className="bg-surface-2 border-border text-fg placeholder:text-fg-3 h-10 w-full rounded-lg border px-3.5 text-sm focus:outline-hidden"
					/>
				</div>

				{/* Memory Items List */}
				<div className="mt-6">
					{filtered.length === 0 ? (
						<div className="border-border rounded-lg border border-dashed p-8 text-center">
							<p className="text-fg font-serif text-lg">
								No memory entries found
							</p>
							<p className="text-fg-2 mx-auto mt-1 max-w-md text-sm">
								{searchQuery
									? "No entries match your search query."
									: "Memory documents will accumulate as this agent processes jobs and learns context."}
							</p>
						</div>
					) : (
						<div className="divide-border divide-y">
							{filtered.map((item) => (
								<div
									key={item.id}
									className="flex items-start justify-between gap-4 py-4"
								>
									<div>
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-medium">{item.title}</h3>
											<span className="bg-surface-2 text-fg-3 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
												{item.type.replace("_", " ")}
											</span>
										</div>
										<p className="text-fg-2 mt-1 text-xs leading-relaxed">
											{sanitizeMemoryContent(item.summary)}
										</p>
										<span className="text-fg-3 mt-1.5 block font-mono text-[10px]">
											{item.createdAt.slice(0, 10)} ·{" "}
											{formatMemorySize(item.sizeBytes)}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleDelete(item.id)}
										className="text-fg-3 hover:text-ember text-xs"
										title="Delete memory"
									>
										Delete
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
