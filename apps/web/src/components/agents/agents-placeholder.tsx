// apps/web/src/components/agents/agents-placeholder.tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";

export function AgentsPlaceholder() {
	const q = useQuery(orpc.agents.list.queryOptions());

	if (q.isPending) return <Skeleton className="h-32 w-full" />;
	if (q.isError) {
		return (
			<Card role="alert">
				<p className="text-fg-2">
					The agents could not be loaded. Try reloading the page.
				</p>
			</Card>
		);
	}
	return (
		<Card className="flex flex-col gap-1">
			<p className="font-medium">No agents yet</p>
			<p className="text-fg-2">
				Agents you mint or hire will show up here. The full page arrives in F3.
			</p>
			<p className="num text-fg-3 text-[13px]">{q.data.agents.length} listed</p>
		</Card>
	);
}
