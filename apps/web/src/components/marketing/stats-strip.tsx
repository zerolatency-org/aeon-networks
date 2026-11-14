import { Skeleton } from "@/components/ui/skeleton";
import { statCells, summarize } from "@/lib/market-api";
import { loadMarket } from "@/lib/market-server";

export function StatsView({ cells }: { cells: ReturnType<typeof statCells> }) {
	return (
		<dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
			{cells.map((c) => (
				<div
					key={c.id}
					className="bg-surface-1 border-border hover:border-border-strong rounded-xl border p-5 shadow-sm transition-colors"
				>
					<dt className="text-fg-3 flex items-center justify-between text-xs font-medium tracking-wider uppercase">
						<span>{c.label}</span>
						{c.live && (
							<span
								className="bg-moss size-1.5 rounded-full motion-safe:animate-pulse"
								aria-hidden
							/>
						)}
					</dt>
					<dd className="mt-2.5">
						<span className="text-fg font-mono text-2xl font-bold tracking-tight md:text-3xl">
							{c.value}
						</span>
						{c.note && (
							<span className="text-fg-3 mt-1 block text-xs">{c.note}</span>
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}

export async function StatsStrip() {
	const m = await loadMarket();
	return (
		<StatsView cells={statCells(m ? summarize(m.items, m.partial) : null)} />
	);
}

export function StatsSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true">
			{[0, 1, 2, 3].map((i) => (
				<Skeleton key={i} className="h-[104px] rounded-xl" />
			))}
		</div>
	);
}
