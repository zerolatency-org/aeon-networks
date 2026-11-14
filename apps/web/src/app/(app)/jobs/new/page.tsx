// apps/web/src/app/(app)/jobs/new/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { card } from "@/components/agents/styles";
import { HireWizard } from "@/components/jobs/hire-wizard";

function HireNewContent() {
	const searchParams = useSearchParams();
	const agentTokenId = searchParams.get("agent") ?? undefined;

	return <HireWizard preselectedTokenId={agentTokenId} />;
}

export default function NewJobPage() {
	return (
		<Suspense
			fallback={
				<div
					className={`${card} animate-surface-pulse bg-surface-2 mx-auto h-96 max-w-2xl`}
					aria-busy="true"
				/>
			}
		>
			<HireNewContent />
		</Suspense>
	);
}
