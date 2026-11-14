// apps/web/src/components/agents/mint-tracker.tsx
"use client";

import Link from "next/link";

import { type MintProgress, trackerRows } from "@/lib/mint-flow";

import { card, primary, quiet } from "./styles";

const DOT: Record<string, string> = {
	done: "bg-moss",
	active: "bg-lumen animate-pulse",
	failed: "bg-coral",
	pending: "bg-surface-3",
};

export function MintTracker(props: {
	progress: MintProgress;
	onRetry: () => void;
	onStartOver: () => void;
}) {
	const { progress } = props;
	const problem = progress.problem;
	return (
		<div className={card} aria-live="polite">
			<h2 className="font-serif text-2xl">Minting your agent</h2>
			<ol className="mt-4 space-y-4">
				{trackerRows(progress).map((row) => (
					<li key={row.step} className="flex gap-3">
						<span
							className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.state]}`}
						/>
						<div>
							<p className={row.state === "pending" ? "text-fg-3" : "text-fg"}>
								{row.title}
							</p>
							<p className="text-fg-2 text-sm">{row.hint}</p>
							{row.note && (
								<p
									className={`num ${row.state === "failed" ? "text-coral" : "text-fg-2"}`}
								>
									{row.note}
								</p>
							)}
						</div>
					</li>
				))}
			</ol>
			{progress.status === "failed" && problem && (
				<div className="mt-5 flex flex-wrap gap-3">
					{problem.retryable && (
						<button type="button" className={primary} onClick={props.onRetry}>
							Try again
						</button>
					)}
					{problem.code === "ALREADY_CONFIRMED" ? (
						<Link href="/agents" className={primary}>
							See my agents
						</Link>
					) : (
						!problem.retryable && (
							<button
								type="button"
								className={quiet}
								onClick={props.onStartOver}
							>
								Start over
							</button>
						)
					)}
				</div>
			)}
		</div>
	);
}
