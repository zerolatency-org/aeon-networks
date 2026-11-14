// apps/web/src/app/(app)/agents/page.tsx
import type { Metadata } from "next";

import { AgentsPlaceholder } from "@/components/agents/agents-placeholder";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
	return (
		<main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-12">
			<h1 className="font-serif text-[56px] leading-[60px] tracking-tight">
				Agents
			</h1>
			<AgentsPlaceholder />
		</main>
	);
}
