// apps/web/src/components/jobs/sub-jobs-tree.tsx
import Link from "next/link";

import { formatOg } from "@/lib/format";
import { jobStateBadge } from "@/lib/job-state";
import type { JobView } from "@/lib/jobs-api";

export type SubJobNode = {
	job: JobView;
	agentName?: string;
	children?: SubJobNode[];
};

export function SubJobsTree({
	rootJob,
	subJobs = [],
}: {
	rootJob: JobView;
	subJobs?: SubJobNode[];
}) {
	const rootBadge = jobStateBadge(rootJob.state);

	return (
		<div className="border-border bg-surface-1 rounded-xl border p-5">
			<div className="flex items-center justify-between">
				<h3 className="font-serif text-lg font-medium">
					Sub-Job Delegation Tree
				</h3>
				<span className="text-fg-3 text-xs">Hierarchy depth</span>
			</div>
			<p className="text-fg-3 mt-1 text-xs">
				Autonomous agent-to-agent hires executed during this job run.
			</p>

			<div className="mt-4 space-y-3 font-mono text-xs">
				{/* Root Node */}
				<div className="border-border/80 bg-surface-2/60 flex items-center justify-between rounded-lg border p-3">
					<div className="flex items-center gap-2">
						<span className="text-lumen font-bold">●</span>
						<span className="text-fg font-medium">
							Root Job #{rootJob.jobId}
						</span>
						<span className="text-fg-3">(Agent #{rootJob.tokenId})</span>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-fg font-medium">
							{formatOg(BigInt(rootJob.amount))} 0G
						</span>
						<span className="text-fg-2">{rootBadge.label}</span>
					</div>
				</div>

				{/* Sub-jobs branches */}
				{subJobs.length === 0 ? (
					<p className="text-fg-3 font-sans text-xs italic">
						No sub-agent jobs delegated for this task.
					</p>
				) : (
					<div className="border-border ml-2 space-y-2 border-l-2 pl-4">
						{subJobs.map((node) => {
							const nodeBadge = jobStateBadge(node.job.state);
							return (
								<Link
									key={node.job.jobId}
									href={`/jobs/${node.job.jobId}`}
									className="border-border bg-surface-2/40 hover:bg-surface-2 flex items-center justify-between rounded-lg border p-2.5 transition-colors"
								>
									<div className="flex items-center gap-2">
										<span className="text-fg-3">↳</span>
										<span className="text-fg font-medium">
											Sub-Job #{node.job.jobId}
										</span>
										<span className="text-fg-3">
											({node.agentName ?? `Agent #${node.job.tokenId}`})
										</span>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-fg font-medium">
											{formatOg(BigInt(node.job.amount))} 0G
										</span>
										<span className="text-fg-2">{nodeBadge.label}</span>
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
