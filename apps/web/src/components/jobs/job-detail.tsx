// apps/web/src/components/jobs/job-detail.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { card, quiet } from "@/components/agents/styles";
import { formatOg } from "@/lib/format";
import {
	jobStateBadge,
	plainWordsStatusLine,
	timelineRows,
} from "@/lib/job-state";
import { fetchJobVerdict } from "@/lib/jobs-api";
import { useJobPolling } from "@/lib/use-job-polling";
import { JobActions } from "./job-actions";
import { SubJobsTree } from "./sub-jobs-tree";

const STATUS_ICONS = {
	done: "✓",
	active: "●",
	pending: "○",
} as const;

export function JobDetail({ jobId }: { jobId: string }) {
	const { data: job, isLoading, isError, refetch } = useJobPolling(jobId);

	const { data: verdict } = useQuery({
		queryKey: ["jobs", jobId, "verdict"],
		queryFn: () => fetchJobVerdict(jobId),
		enabled: Boolean(
			job && (job.state === "completed" || job.state === "disputed"),
		),
	});

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div
					className={`${card} animate-surface-pulse bg-surface-2 h-48`}
					aria-busy="true"
				/>
				<div
					className={`${card} animate-surface-pulse bg-surface-2 h-64`}
					aria-busy="true"
				/>
			</div>
		);
	}

	if (isError || !job) {
		return (
			<div className={`${card} text-center`}>
				<h2 className="font-serif text-2xl font-medium">Job Not Found</h2>
				<p className="text-fg-2 mt-2 text-sm">
					We could not load this job record. It may not exist or your connected
					wallet is not a party to this contract.
				</p>
				<div className="mt-4 flex justify-center gap-3">
					<button
						type="button"
						onClick={() => void refetch()}
						className={quiet}
					>
						Retry
					</button>
					<Link href="/jobs" className={quiet}>
						All jobs
					</Link>
				</div>
			</div>
		);
	}

	const badge = jobStateBadge(job.state);
	const rows = timelineRows(job);
	const statusLine = plainWordsStatusLine(job);

	return (
		<div className="space-y-8">
			{/* Breadcrumb */}
			<nav aria-label="Breadcrumb">
				<Link
					href="/jobs"
					className="text-fg-3 hover:text-fg text-xs font-medium transition-colors"
				>
					← Back to Jobs
				</Link>
			</nav>

			{/* Job Header */}
			<div className={card}>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="font-serif text-3xl font-semibold">
								Job #{job.jobId}
							</h1>
							<span className="text-fg-3 font-mono text-sm">
								Agent #{job.tokenId}
							</span>
						</div>
						<p className="text-fg-2 mt-1 text-sm">{statusLine}</p>
					</div>

					<div className="text-left sm:text-right">
						<span className="text-fg-3 block text-xs">Escrow Amount</span>
						<span className="text-fg font-mono text-2xl font-semibold">
							{formatOg(BigInt(job.amount))} 0G
						</span>
						<span className="text-fg-3 block text-xs">
							Status: <span className="text-fg font-medium">{badge.label}</span>
						</span>
					</div>
				</div>

				<div className="border-border mt-6 grid grid-cols-2 gap-4 border-t pt-4 text-xs sm:grid-cols-4">
					<div>
						<span className="text-fg-3 block">Client</span>
						<span className="text-fg block truncate font-mono">
							{job.client}
						</span>
					</div>
					<div>
						<span className="text-fg-3 block">Provider Payee</span>
						<span className="text-fg block truncate font-mono">
							{job.payee}
						</span>
					</div>
					<div>
						<span className="text-fg-3 block">Evaluator</span>
						<span className="text-fg block truncate font-mono">
							{job.evaluator}
						</span>
					</div>
					<div>
						<span className="text-fg-3 block">Expires At</span>
						<span className="text-fg block font-mono">
							{job.expiredAt.slice(0, 16).replace("T", " ")}
						</span>
					</div>
				</div>
			</div>

			{/* Actions (if available to current user) */}
			<JobActions job={job} />

			{/* Timeline Progress */}
			<div className={card}>
				<h2 className="font-serif text-xl font-medium">
					Job Lifecycle Timeline
				</h2>
				<p className="text-fg-3 mt-1 text-xs">
					Live cryptographic milestones verified by 0G Escrow contracts.
				</p>

				<div className="mt-6 space-y-6">
					{rows.map((row, idx) => (
						<div key={row.step} className="flex items-start gap-4">
							<div
								className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
									row.status === "done"
										? "bg-moss/20 text-moss"
										: row.status === "active"
											? "bg-lumen/20 text-lumen animate-pulse"
											: "bg-surface-2 text-fg-3"
								}`}
							>
								{STATUS_ICONS[row.status]}
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-medium">{row.title}</h3>
									{row.time && (
										<span className="text-fg-3 font-mono text-xs">
											{row.time.slice(11, 19)}
										</span>
									)}
								</div>
								<p className="text-fg-2 mt-0.5 text-xs">{row.description}</p>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Verification Verdict (if present) */}
			{verdict && (
				<div className={card}>
					<div className="flex items-center justify-between">
						<h2 className="font-serif text-xl font-medium">
							Evaluation Verdict
						</h2>
						<span
							className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
								verdict.verdict === "accept"
									? "bg-moss/10 text-moss"
									: "bg-ember/10 text-ember"
							}`}
						>
							{verdict.verdict.toUpperCase()}
						</span>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
						<div>
							<span className="text-fg-3 block">Evaluator Model</span>
							<span className="text-fg font-medium">{verdict.model}</span>
						</div>
						{verdict.score !== null && (
							<div>
								<span className="text-fg-3 block">Score</span>
								<span className="text-fg font-mono font-medium">
									{verdict.score}/100
								</span>
							</div>
						)}
						<div>
							<span className="text-fg-3 block">Decided At</span>
							<span className="text-fg font-mono">
								{verdict.createdAt.slice(0, 16).replace("T", " ")}
							</span>
						</div>
					</div>
				</div>
			)}

			{/* Sub-Jobs Hierarchy */}
			<SubJobsTree rootJob={job} />
		</div>
	);
}
