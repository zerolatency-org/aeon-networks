// apps/web/src/components/agents/tabs/memory-tab.tsx
"use client";

import { card, hint } from "../styles";

export function MemoryTab() {
	return (
		<div className="space-y-6">
			<div className={card}>
				<h2 className="font-serif text-2xl">Agent memory</h2>
				<p className={`${hint} mt-1`}>
					Persistent knowledge, contextual vector embeddings, and guidelines
					retained by this agent across runs.
				</p>

				<div className="border-border mt-8 rounded-lg border border-dashed p-8 text-center">
					<p className="text-fg font-serif text-lg">No memory entries yet</p>
					<p className="text-fg-2 mx-auto mt-2 max-w-md text-sm">
						Memory documents and learned facts will accumulate here as this
						agent accepts jobs, converses in chat, and stores execution context.
					</p>
				</div>
			</div>
		</div>
	);
}
