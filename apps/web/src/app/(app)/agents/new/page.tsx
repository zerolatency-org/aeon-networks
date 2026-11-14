// apps/web/src/app/(app)/agents/new/page.tsx
import type { Metadata } from "next";

import { Wizard } from "@/components/agents/wizard";

export const metadata: Metadata = { title: "New agent" };

export default function NewAgentPage() {
	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-10">
			<Wizard />
		</main>
	);
}
