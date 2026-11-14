// apps/web/src/components/agents/earnings-chart.tsx
"use client";

import { useState } from "react";

import { card } from "@/components/agents/styles";
import type { EarningsSeries } from "@/lib/earnings-view";

export function EarningsChart({ series }: { series: EarningsSeries }) {
	const [showTable, setShowTable] = useState(false);

	if (series.daily.length === 0) {
		return null;
	}

	const maxDaily = series.daily.reduce(
		(max, d) => (d.amountWei > max ? d.amountWei : max),
		1n,
	);

	return (
		<div className={card}>
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-serif text-lg font-medium">Earnings Over Time</h3>
					<p className="text-fg-3 text-xs">
						Settled revenue from finished jobs
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowTable(!showTable)}
					className="text-fg-3 hover:text-fg text-xs font-medium underline"
				>
					{showTable ? "Hide table" : "View as table"}
				</button>
			</div>

			{/* Visual Bar Chart */}
			<div className="border-border mt-6 flex h-40 items-end gap-3 border-b pt-6">
				{series.daily.map((day) => {
					const heightPercent = Number((day.amountWei * 100n) / maxDaily);
					const clampedHeight = Math.max(8, Math.min(100, heightPercent));

					return (
						<div
							key={day.date}
							className="group relative flex h-full flex-1 flex-col items-center justify-end"
						>
							{/* Tooltip */}
							<div className="bg-surface-3 text-fg pointer-events-none absolute -top-8 hidden rounded px-1.5 py-0.5 font-mono text-[10px] shadow-xs group-hover:block">
								{day.formatted0G} ({day.jobCount} jobs)
							</div>

							{/* Bar */}
							<div
								style={{ height: `${clampedHeight}%` }}
								className="bg-moss/80 hover:bg-moss w-full rounded-t transition-all group-hover:opacity-90"
							/>

							{/* Date Label */}
							<span className="text-fg-3 mt-2 font-mono text-[10px]">
								{day.date.slice(5)}
							</span>
						</div>
					);
				})}
			</div>

			{/* Accessible Table Fallback */}
			{showTable && (
				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-border text-fg-3 border-b">
								<th className="py-2">Date</th>
								<th className="py-2">Jobs Finished</th>
								<th className="py-2 text-right">Settled Amount</th>
							</tr>
						</thead>
						<tbody className="divide-border divide-y">
							{series.daily.map((day) => (
								<tr key={day.date}>
									<td className="py-2 font-mono">{day.date}</td>
									<td className="py-2">{day.jobCount}</td>
									<td className="py-2 text-right font-mono font-medium">
										{day.formatted0G}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
