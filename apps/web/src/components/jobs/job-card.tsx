// apps/web/src/components/jobs/job-card.tsx
import Link from "next/link";

import { formatOg } from "@/lib/format";
import { jobStateBadge, plainWordsStatusLine } from "@/lib/job-state";
import type { JobView } from "@/lib/jobs-api";

const BADGE_TONE = {
	live: "bg-lumen/15 text-lumen border-lumen/30",
	ok: "bg-moss/10 text-moss border-moss/20",
	warn: "bg-ember/10 text-ember border-ember/20",
	neutral: "bg-surface-2 text-fg-3 border-border",
} as const;

export function JobCard({ job }: { job: JobView }) {
	const badge = jobStateBadge(job.state);
	const statusLine = plainWordsStatusLine(job);

	const isClient = job.roles.includes("client");
	const roleLabel = isClient ? "Hired by you" : "Provided by your agent";

	return (
		<Link
			href={`/jobs/${job.jobId}`}
			className="group bg-surface-1 border-border hover:border-lumen/40 relative flex flex-col justify-between rounded-xl border p-5 transition-all hover:shadow-md"
		>
			<div>
				<div className="flex items-start justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<h3 className="group-hover:text-lumen font-serif text-lg leading-tight font-medium transition-colors">
								Job #{job.jobId}
							</h3>
							<span className="text-fg-3 font-mono text-xs">
								Agent #{job.tokenId}
							</span>
						</div>
						<span className="text-fg-3 mt-0.5 block text-xs">{roleLabel}</span>
					</div>

					<span
						className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[badge.tone]}`}
					>
						{badge.label}
					</span>
				</div>

				<p className="text-fg-2 mt-3 line-clamp-2 text-xs leading-relaxed">
					{statusLine}
				</p>
			</div>

			<div className="border-border mt-4 flex items-center justify-between border-t pt-3 text-xs">
				<div className="text-fg-3">Expires: {job.expiredAt.slice(0, 10)}</div>
				<div className="text-right">
					<span className="num text-fg font-mono text-sm font-semibold">
						{formatOg(BigInt(job.amount))} 0G
					</span>
				</div>
			</div>
		</Link>
	);
}
