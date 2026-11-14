import { JOB_STEPS, LANES } from "@/content/marketing";
import { movesNote } from "@/lib/job-scene";
export function JobLoopList() {
	return (
		<ol className="grid gap-3">
			{JOB_STEPS.map((s) => (
				<li key={s.id} className="glass flex gap-4 rounded-xl p-4">
					<span className="num text-fg-3 w-6 shrink-0">{s.n}</span>
					<div>
						<p className="text-fg">
							{s.title}{" "}
							<span className="text-fg-3">
								· {LANES.find((l) => l.id === s.lane)?.label}
							</span>
						</p>
						<p className="text-fg-2 text-sm">{s.line}</p>
						<p className="text-fg-3 mt-1 text-xs">{movesNote(s.moves)}</p>
					</div>
				</li>
			))}
		</ol>
	);
}
