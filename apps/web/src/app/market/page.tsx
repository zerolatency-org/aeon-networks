// apps/web/src/app/market/page.tsx
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { card, primary, quiet } from "@/components/agents/styles";
import { MarketCard } from "@/components/market/market-card";
import { MarketFilters } from "@/components/market/market-filters";
import {
	fetchMarketAgents,
	type MarketItem,
	type MarketPage as MarketPageData,
} from "@/lib/market-api";
import {
	applyMarketFilters,
	DEFAULT_FILTER_STATE,
	type MarketFilterState,
} from "@/lib/market-filter";

const Market3d = dynamic(
	() => import("@/components/marketing/market3d").then((mod) => mod.Market3d),
	{
		ssr: false,
		loading: () => (
			<div className="bg-surface-2 animate-surface-pulse flex h-64 w-full items-center justify-center rounded-xl">
				<span className="text-fg-3 text-sm">Loading market graph...</span>
			</div>
		),
	},
);

export default function MarketPage() {
	const [filters, setFilters] =
		useState<MarketFilterState>(DEFAULT_FILTER_STATE);
	const [viewMode, setViewMode] = useState<"grid" | "graph">("grid");

	const {
		data,
		isLoading,
		isError,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
		refetch,
	} = useInfiniteQuery<MarketPageData>({
		queryKey: ["market", "agents", filters.q, filters.tag, filters.sort],
		queryFn: ({ pageParam }) =>
			fetchMarketAgents({
				q: filters.q,
				tag: filters.tag ?? undefined,
				cursor: pageParam as string | undefined,
			}),
		initialPageParam: undefined,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});

	const allItems: MarketItem[] = useMemo(() => {
		if (!data) return [];
		return data.pages.flatMap((p) => p.items);
	}, [data]);

	const displayedAgents = useMemo(() => {
		return applyMarketFilters(allItems, filters);
	}, [allItems, filters]);

	return (
		<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
			{/* Header */}
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="font-serif text-3xl font-semibold sm:text-4xl">
						Agent Marketplace
					</h1>
					<p className="text-fg-2 mt-2 max-w-2xl text-sm sm:text-base">
						Discover, verify, and hire autonomous agents running on 0G. Every
						job payment is held safely in escrow and evaluated on-chain.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setViewMode("grid")}
						className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
							viewMode === "grid"
								? "bg-surface-3 text-fg font-semibold"
								: "text-fg-2 hover:text-fg"
						}`}
					>
						Grid View
					</button>
					<button
						type="button"
						onClick={() => setViewMode("graph")}
						className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
							viewMode === "graph"
								? "bg-surface-3 text-fg font-semibold"
								: "text-fg-2 hover:text-fg"
						}`}
					>
						Graph View
					</button>
				</div>
			</div>

			{/* Filters Bar */}
			<div className="mt-8">
				<MarketFilters
					state={filters}
					onChange={(updates) =>
						setFilters((prev) => ({ ...prev, ...updates }))
					}
				/>
			</div>

			{/* View Modes */}
			{viewMode === "graph" ? (
				<div className="border-border bg-surface-1 mt-8 h-96 w-full overflow-hidden rounded-xl border">
					<Market3d onReady={() => {}} />
				</div>
			) : (
				<div className="mt-8">
					{isLoading && (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{Array.from({ length: 6 }).map((_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items
									key={i}
									className={`${card} animate-surface-pulse bg-surface-2 h-48`}
									aria-busy="true"
								/>
							))}
						</div>
					)}

					{isError && (
						<div className={`${card} text-center`}>
							<p className="text-fg-2">Unable to load marketplace agents.</p>
							<button
								type="button"
								onClick={() => void refetch()}
								className={`${quiet} mt-3`}
							>
								Try again
							</button>
						</div>
					)}

					{!isLoading && !isError && displayedAgents.length === 0 && (
						<div className="border-border rounded-xl border border-dashed p-12 text-center">
							<h3 className="font-serif text-lg font-medium">
								No agents found
							</h3>
							<p className="text-fg-2 mx-auto mt-1 max-w-sm text-sm">
								No listed agents match your active search filters. Try clearing
								your filters or searching with different terms.
							</p>
							<button
								type="button"
								onClick={() => setFilters(DEFAULT_FILTER_STATE)}
								className={`${quiet} mt-4`}
							>
								Clear all filters
							</button>
						</div>
					)}

					{!isLoading && displayedAgents.length > 0 && (
						<>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{displayedAgents.map((agent) => (
									<MarketCard key={agent.tokenId} agent={agent} />
								))}
							</div>

							{hasNextPage && (
								<div className="mt-10 flex justify-center">
									<button
										type="button"
										onClick={() => void fetchNextPage()}
										disabled={isFetchingNextPage}
										className={primary}
									>
										{isFetchingNextPage
											? "Loading more..."
											: "Load more agents"}
									</button>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
