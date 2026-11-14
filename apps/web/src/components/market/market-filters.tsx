// apps/web/src/components/market/market-filters.tsx
"use client";

import type { MarketFilterState, MarketSort } from "@/lib/market-filter";

const POPULAR_TAGS = [
	"research",
	"finance",
	"audit",
	"summarization",
	"code",
	"data",
];

export function MarketFilters({
	state,
	onChange,
}: {
	state: MarketFilterState;
	onChange: (next: Partial<MarketFilterState>) => void;
}) {
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{/* Search Input */}
				<div className="relative flex-1">
					<input
						type="search"
						value={state.q}
						onChange={(e) => onChange({ q: e.target.value })}
						placeholder="Search by agent name, capability, or keyword..."
						className="bg-surface-1 border-border text-fg placeholder:text-fg-3 focus:border-lumen h-10 w-full rounded-lg border px-3.5 text-sm transition-colors focus:outline-hidden"
					/>
				</div>

				{/* Sort Selector */}
				<div className="flex items-center gap-2">
					<label
						htmlFor="market-sort"
						className="text-fg-3 text-xs font-medium"
					>
						Sort:
					</label>
					<select
						id="market-sort"
						value={state.sort}
						onChange={(e) => onChange({ sort: e.target.value as MarketSort })}
						className="bg-surface-1 border-border text-fg h-10 rounded-lg border px-3 text-sm focus:outline-hidden"
					>
						<option value="jobs">Most jobs completed</option>
						<option value="price-asc">Price: low to high</option>
						<option value="price-desc">Price: high to low</option>
						<option value="newest">Newest listings</option>
					</select>
				</div>
			</div>

			{/* Tag filter pills */}
			<div className="flex flex-wrap items-center gap-2 pt-1">
				<span className="text-fg-3 text-xs font-medium">Tags:</span>
				{POPULAR_TAGS.map((tag) => {
					const active = state.tag?.toLowerCase() === tag.toLowerCase();
					return (
						<button
							key={tag}
							type="button"
							onClick={() => onChange({ tag: active ? null : tag })}
							className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
								active
									? "bg-lumen text-fg-inverse shadow-xs"
									: "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg"
							}`}
						>
							{tag}
						</button>
					);
				})}
				{state.tag && !POPULAR_TAGS.includes(state.tag) && (
					<button
						type="button"
						onClick={() => onChange({ tag: null })}
						className="bg-lumen text-fg-inverse rounded-full px-3 py-1 text-xs font-medium shadow-xs"
					>
						{state.tag} ×
					</button>
				)}
			</div>
		</div>
	);
}
