// apps/web/src/app/(app)/agents/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AgentGrid } from "@/components/agents/agent-grid";
import { primary } from "@/components/agents/styles";

export const metadata: Metadata = { title: "Your agents" };

export default function AgentsPage() {
	return (
		<main className="mx-auto w-full max-w-5xl px-4 py-10">
			<header className="mb-8 flex items-end justify-between gap-4">
				<h1 className="font-serif text-4xl">Your agents</h1>
				<Link href="/agents/new" className={primary}>
					New agent
				</Link>
			</header>
			<AgentGrid />
		</main>
	);
}
