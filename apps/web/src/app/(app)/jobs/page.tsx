// apps/web/src/app/(app)/jobs/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { card, primary, quiet } from "@/components/agents/styles";
import { JobCard } from "@/components/jobs/job-card";
import { fetchJobsList, type JobView } from "@/lib/jobs-api";

type FilterTab = "all" | "active" | "completed" | "disputed";

export default function JobsPage() {
	const [activeTab, setActiveTab] = useState<FilterTab>("all");

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ["jobs"],
		queryFn: () => fetchJobsList(),
	});

	const allJobs: JobView[] = data?.jobs ?? [];

	const filteredJobs = allJobs.filter((job) => {
		if (activeTab === "all") return true;
		if (activeTab === "active")
			return job.state === "funded" || job.state === "submitted";
		if (activeTab === "completed") return job.state === "completed";
		if (activeTab === "disputed") return job.state === "disputed";
		return true;
	});

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="font-serif text-4xl font-semibold">Jobs</h1>
					<p className="text-fg-2 mt-1 text-sm">
						Track your active hires, agent assignments, deliverables, and escrow
						payouts.
					</p>
				</div>
				<div>
					<Link href="/market" className={primary}>
						Hire an agent
					</Link>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="border-border flex gap-2 border-b pb-2">
				{(["all", "active", "completed", "disputed"] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
							activeTab === tab
								? "bg-surface-2 text-fg font-semibold"
								: "text-fg-2 hover:text-fg"
						}`}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Content */}
			{isLoading && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
							key={i}
							className={`${card} animate-surface-pulse bg-surface-2 h-40`}
							aria-busy="true"
						/>
					))}
				</div>
			)}

			{isError && (
				<div className={`${card} text-center`}>
					<p className="text-fg-2">Unable to load your jobs history.</p>
					<button
						type="button"
						onClick={() => void refetch()}
						className={`${quiet} mt-3`}
					>
						Try again
					</button>
				</div>
			)}

			{!isLoading && !isError && filteredJobs.length === 0 && (
				<div className="border-border rounded-xl border border-dashed p-12 text-center">
					<h3 className="font-serif text-lg font-medium">No jobs found</h3>
					<p className="text-fg-2 mx-auto mt-1 max-w-sm text-sm">
						{activeTab === "all"
							? "You have not created or received any jobs yet. Browse the marketplace to hire your first agent."
							: `No jobs currently matching the ${activeTab} filter.`}
					</p>
					<div className="mt-4 flex justify-center">
						<Link href="/market" className={primary}>
							Browse marketplace
						</Link>
					</div>
				</div>
			)}

			{!isLoading && filteredJobs.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredJobs.map((job) => (
						<JobCard key={job.jobId} job={job} />
					))}
				</div>
			)}
		</div>
	);
}
