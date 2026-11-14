// apps/web/src/lib/market-filter.ts
import type { MarketItem } from "./market-api";

export type MarketSort = "jobs" | "price-asc" | "price-desc" | "newest";

export type MarketFilterState = {
	q: string;
	tag: string | null;
	minPrice: string | null;
	maxPrice: string | null;
	sort: MarketSort;
	minJobs: number;
};

export const DEFAULT_FILTER_STATE: MarketFilterState = {
	q: "",
	tag: null,
	minPrice: null,
	maxPrice: null,
	sort: "jobs",
	minJobs: 0,
};

export function parseMarketSearchParams(
	searchParams: URLSearchParams,
): MarketFilterState {
	const q = searchParams.get("q") ?? "";
	const tag = searchParams.get("tag") || null;
	const minPrice = searchParams.get("minPrice") || null;
	const maxPrice = searchParams.get("maxPrice") || null;
	const rawSort = searchParams.get("sort");
	const sort: MarketSort =
		rawSort === "price-asc" ||
		rawSort === "price-desc" ||
		rawSort === "newest" ||
		rawSort === "jobs"
			? rawSort
			: "jobs";
	const rawMinJobs = searchParams.get("minJobs");
	const minJobs = rawMinJobs
		? Math.max(0, Number.parseInt(rawMinJobs, 10) || 0)
		: 0;

	return {
		q,
		tag,
		minPrice,
		maxPrice,
		sort,
		minJobs,
	};
}

export function filterToSearchParams(
	state: MarketFilterState,
): URLSearchParams {
	const params = new URLSearchParams();
	if (state.q.trim()) params.set("q", state.q.trim());
	if (state.tag?.trim()) params.set("tag", state.tag.trim());
	if (state.minPrice) params.set("minPrice", state.minPrice);
	if (state.maxPrice) params.set("maxPrice", state.maxPrice);
	if (state.minJobs > 0) params.set("minJobs", String(state.minJobs));
	if (state.sort !== "jobs") params.set("sort", state.sort);
	return params;
}

export function updateMarketFilter(
	state: MarketFilterState,
	updates: Partial<MarketFilterState>,
): MarketFilterState {
	return {
		...state,
		...updates,
	};
}

export function toggleFilterTag(
	state: MarketFilterState,
	tag: string,
): MarketFilterState {
	const currentTag = state.tag?.toLowerCase();
	const nextTag = tag.toLowerCase();
	return {
		...state,
		tag: currentTag === nextTag ? null : tag,
	};
}

export function applyMarketFilters(
	items: MarketItem[],
	state: MarketFilterState,
): MarketItem[] {
	let result = [...items];

	if (state.q.trim()) {
		const term = state.q.trim().toLowerCase();
		result = result.filter(
			(item) =>
				item.name.toLowerCase().includes(term) ||
				item.description.toLowerCase().includes(term) ||
				item.tags.some((t) => t.toLowerCase().includes(term)),
		);
	}

	if (state.tag) {
		const targetTag = state.tag.toLowerCase();
		result = result.filter((item) =>
			item.tags.some((t) => t.toLowerCase() === targetTag),
		);
	}

	if (state.minJobs > 0) {
		result = result.filter((item) => item.jobsCompleted >= state.minJobs);
	}

	if (state.minPrice) {
		const min = BigInt(state.minPrice);
		result = result.filter((item) => BigInt(item.price) >= min);
	}

	if (state.maxPrice) {
		const max = BigInt(state.maxPrice);
		result = result.filter((item) => BigInt(item.price) <= max);
	}

	result.sort((a, b) => {
		if (state.sort === "jobs") {
			if (b.jobsCompleted !== a.jobsCompleted) {
				return b.jobsCompleted - a.jobsCompleted;
			}
			return BigInt(a.price) < BigInt(b.price) ? -1 : 1;
		}
		if (state.sort === "price-asc") {
			const pa = BigInt(a.price);
			const pb = BigInt(b.price);
			if (pa !== pb) return pa < pb ? -1 : 1;
			return b.jobsCompleted - a.jobsCompleted;
		}
		if (state.sort === "price-desc") {
			const pa = BigInt(a.price);
			const pb = BigInt(b.price);
			if (pa !== pb) return pa > pb ? -1 : 1;
			return b.jobsCompleted - a.jobsCompleted;
		}
		if (state.sort === "newest") {
			return Number(BigInt(b.tokenId) - BigInt(a.tokenId));
		}
		return 0;
	});

	return result;
}
