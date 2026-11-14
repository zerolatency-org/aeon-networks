import { JOB_STEPS, LANES } from "@/content/marketing";
import { movesNote } from "@/lib/job-scene";

export function JobLoopList() {
	return (
		<ol className="grid gap-3">
			{JOB_STEPS.map((s) => (
				<li
					key={s.id}
					className="bg-surface-1 border-border hover:border-border-strong flex gap-4 rounded-xl border p-4 shadow-sm transition-colors"
				>
					<span className="text-fg-3 w-6 shrink-0 font-mono text-sm font-semibold">
						{s.n < 10 ? `0${s.n}` : s.n}
					</span>
					<div>
						<p className="text-fg font-medium">
							{s.title}{" "}
							<span className="text-fg-3 font-normal">
								· {LANES.find((l) => l.id === s.lane)?.label}
							</span>
						</p>
						<p className="text-fg-2 mt-0.5 text-sm leading-relaxed">{s.line}</p>
						<p className="text-fg-3 mt-1 text-xs">{movesNote(s.moves)}</p>
					</div>
				</li>
			))}
		</ol>
	);
}
