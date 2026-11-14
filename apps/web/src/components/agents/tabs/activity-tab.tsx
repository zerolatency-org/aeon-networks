// apps/web/src/components/agents/tabs/activity-tab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type ActivityCategory,
	type ActivityEvent,
	filterEvents,
	groupEventsByDay,
} from "@/lib/activity-feed";
import { formatOg } from "@/lib/format";
import { fetchJobsList, type JobView } from "@/lib/jobs-api";
import { card, hint } from "../styles";

export function ActivityTab() {
	const [category, setCategory] = useState<ActivityCategory>("all");

	const { data } = useQuery({
		queryKey: ["jobs"],
		queryFn: () => fetchJobsList(),
	});

	const jobs: JobView[] = data?.jobs ?? [];

	const events: ActivityEvent[] = useMemo(() => {
		const list: ActivityEvent[] = [];

		for (const j of jobs) {
			list.push({
				id: `job_c_${j.jobId}`,
				kind: "job_created",
				timestamp: j.expiredAt,
				title: `Job #${j.jobId} Commissioned`,
				description: `Escrow funded with ${formatOg(BigInt(j.amount))} 0G.`,
				amountWei: BigInt(j.amount),
				jobId: j.jobId,
			});

			if (j.state === "completed" && j.settledAt) {
				list.push({
					id: `job_s_${j.jobId}`,
					kind: "job_completed",
					timestamp: j.settledAt,
					title: `Job #${j.jobId} Settled`,
					description: "Deliverable accepted; funds released to provider.",
					amountWei: BigInt(j.amount),
					jobId: j.jobId,
				});
			} else if (j.state === "disputed") {
				list.push({
					id: `job_d_${j.jobId}`,
					kind: "job_disputed",
					timestamp: j.submittedAt ?? j.expiredAt,
					title: `Job #${j.jobId} Disputed`,
					description: "Deliverable disputed by evaluator.",
					jobId: j.jobId,
				});
			}
		}

		return list;
	}, [jobs]);

	const filtered = filterEvents(events, category);
	const groups = groupEventsByDay(filtered);

	return (
		<div className="space-y-6">
			<div className={card}>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="font-serif text-2xl">Activity log</h2>
						<p className={`${hint} mt-1`}>
							Immutable record of jobs executed, sub-agent delegations,
							verification checks, and escrow payouts.
						</p>
					</div>

					{/* Category filter pills */}
					<div className="flex items-center gap-2">
						{(["all", "jobs", "funds"] as const).map((cat) => (
							<button
								key={cat}
								type="button"
								onClick={() => setCategory(cat)}
								className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
									category === cat
										? "bg-surface-3 text-fg font-semibold"
										: "text-fg-2 hover:text-fg"
								}`}
							>
								{cat}
							</button>
						))}
					</div>
				</div>

				{/* Activity Feed */}
				<div className="mt-8">
					{groups.length === 0 ? (
						<div className="border-border rounded-lg border border-dashed p-8 text-center">
							<p className="text-fg font-serif text-lg">
								No activity recorded yet
							</p>
							<p className="text-fg-2 mx-auto mt-2 max-w-md text-sm">
								Activity entries will appear here once the agent begins
								interacting with the marketplace and processing job requests.
							</p>
						</div>
					) : (
						<div className="space-y-8">
							{groups.map((group) => (
								<div key={group.dateKey} className="space-y-3">
									<h3 className="text-fg-3 font-mono text-xs font-semibold tracking-wider uppercase">
										{group.dayLabel}
									</h3>
									<div className="divide-border bg-surface-2/40 border-border divide-y rounded-xl border">
										{group.events.map((event) => (
											<div
												key={event.id}
												className="flex items-start justify-between gap-4 p-3.5 text-xs"
											>
												<div className="flex items-start gap-3">
													<span className="text-lumen font-bold">●</span>
													<div>
														<h4 className="text-fg font-medium">
															{event.title}
														</h4>
														<p className="text-fg-2 mt-0.5">
															{event.description}
														</p>
													</div>
												</div>
												{event.amountWei !== undefined && (
													<span className="text-fg shrink-0 font-mono font-medium">
														{formatOg(event.amountWei)} 0G
													</span>
												)}
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
