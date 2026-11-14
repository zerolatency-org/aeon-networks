// apps/web/src/app/(app)/agents/[id]/page.tsx
import type { Metadata } from "next";

import { AgentPage } from "@/components/agents/agent-page";
import { tabFromParam } from "@/lib/agent-tabs";

export const metadata: Metadata = { title: "Agent" };

type Props = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: Props) {
	const { id } = await params;
	const { tab } = await searchParams;
	return (
		<main className="mx-auto w-full max-w-5xl px-4 py-10">
			<AgentPage id={id} tab={tabFromParam(tab)} />
		</main>
	);
}
