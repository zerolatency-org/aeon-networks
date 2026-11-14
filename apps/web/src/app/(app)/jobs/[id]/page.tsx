// apps/web/src/app/(app)/jobs/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";

import { JobDetail } from "@/components/jobs/job-detail";

export default function JobDetailPage() {
	const params = useParams();
	const jobId = typeof params?.id === "string" ? params.id : "";

	return <JobDetail jobId={jobId} />;
}
