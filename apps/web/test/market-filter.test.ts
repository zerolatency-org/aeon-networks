// apps/web/test/market-filter.test.ts
import { describe, expect, test } from "bun:test";
import type { MarketItem } from "@/lib/market-api";
import {
	applyMarketFilters,
	filterToSearchParams,
	type MarketFilterState,
	parseMarketSearchParams,
	toggleFilterTag,
	updateMarketFilter,
} from "@/lib/market-filter";

const mockAgents: MarketItem[] = [
	{
		tokenId: "1",
		name: "Alpha Bot",
		description: "Data extraction pipeline",
		tags: ["data", "finance"],
		price: "2000000000000000", // 0.002
		owner: "0x111",
		jobsCompleted: 25,
		jobsDisputed: 1,
		totalSettled: "50000000000000000",
	},
	{
		tokenId: "2",
		name: "Beta Scout",
		description: "Deep web research",
		tags: ["research"],
		price: "1000000000000000", // 0.001
		owner: "0x222",
		jobsCompleted: 50,
		jobsDisputed: 0,
		totalSettled: "50000000000000000",
	},
	{
		tokenId: "3",
		name: "Gamma Code",
		description: "Smart contract audit assistant",
		tags: ["audit", "security"],
		price: "10000000000000000", // 0.01
		owner: "0x333",
		jobsCompleted: 5,
		jobsDisputed: 0,
		totalSettled: "50000000000000000",
	},
];

describe("Market filter & URL sync logic", () => {
	test("parseMarketSearchParams extracts all filter params correctly", () => {
		const search = new URLSearchParams(
			"q=research&tag=web&minPrice=1000&maxPrice=5000&sort=price-asc&minJobs=10",
		);
		const state = parseMarketSearchParams(search);
		expect(state.q).toBe("research");
		expect(state.tag).toBe("web");
		expect(state.minPrice).toBe("1000");
		expect(state.maxPrice).toBe("5000");
		expect(state.sort).toBe("price-asc");
		expect(state.minJobs).toBe(10);
	});

	test("parseMarketSearchParams defaults to empty state and default sort", () => {
		const state = parseMarketSearchParams(new URLSearchParams(""));
		expect(state.q).toBe("");
		expect(state.tag).toBeNull();
		expect(state.minPrice).toBeNull();
		expect(state.maxPrice).toBeNull();
		expect(state.sort).toBe("jobs");
		expect(state.minJobs).toBe(0);
	});

	test("parseMarketSearchParams validates invalid sort and falls back to jobs", () => {
		const state = parseMarketSearchParams(new URLSearchParams("sort=invalid"));
		expect(state.sort).toBe("jobs");
	});

	test("filterToSearchParams converts state to search params omitting blanks", () => {
		const state: MarketFilterState = {
			q: "audit",
			tag: "security",
			minPrice: "1000",
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		};
		const params = filterToSearchParams(state);
		expect(params.get("q")).toBe("audit");
		expect(params.get("tag")).toBe("security");
		expect(params.get("minPrice")).toBe("1000");
		expect(params.has("maxPrice")).toBe(false);
		expect(params.has("sort")).toBe(false); // default sort omitted
	});

	test("updateMarketFilter returns new state with changes applied", () => {
		const initial: MarketFilterState = {
			q: "old",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		};
		const updated = updateMarketFilter(initial, { q: "new", tag: "ai" });
		expect(updated.q).toBe("new");
		expect(updated.tag).toBe("ai");
		expect(initial.q).toBe("old"); // immutable
	});

	test("toggleFilterTag sets or unsets tag", () => {
		const s1: MarketFilterState = {
			q: "",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		};
		const s2 = toggleFilterTag(s1, "finance");
		expect(s2.tag).toBe("finance");
		const s3 = toggleFilterTag(s2, "finance");
		expect(s3.tag).toBeNull();
		const s4 = toggleFilterTag(s2, "tech");
		expect(s4.tag).toBe("tech");
	});

	test("applyMarketFilters filters by query text matching name or description", () => {
		const filtered = applyMarketFilters(mockAgents, {
			q: "extraction",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		});
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.name).toBe("Alpha Bot");
	});

	test("applyMarketFilters filters by tag", () => {
		const filtered = applyMarketFilters(mockAgents, {
			q: "",
			tag: "research",
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		});
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.name).toBe("Beta Scout");
	});

	test("applyMarketFilters filters by minJobs", () => {
		const filtered = applyMarketFilters(mockAgents, {
			q: "",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 30,
		});
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.name).toBe("Beta Scout");
	});

	test("applyMarketFilters filters by price range", () => {
		const filtered = applyMarketFilters(mockAgents, {
			q: "",
			tag: null,
			minPrice: "1500000000000000",
			maxPrice: "5000000000000000",
			sort: "jobs",
			minJobs: 0,
		});
		expect(filtered.length).toBe(1);
		expect(filtered[0]?.name).toBe("Alpha Bot");
	});

	test("applyMarketFilters sorts by jobs (most completed first)", () => {
		const sorted = applyMarketFilters(mockAgents, {
			q: "",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "jobs",
			minJobs: 0,
		});
		expect(sorted[0]?.name).toBe("Beta Scout");
		expect(sorted[1]?.name).toBe("Alpha Bot");
		expect(sorted[2]?.name).toBe("Gamma Code");
	});

	test("applyMarketFilters sorts by price-asc and price-desc", () => {
		const asc = applyMarketFilters(mockAgents, {
			q: "",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "price-asc",
			minJobs: 0,
		});
		expect(asc[0]?.name).toBe("Beta Scout");
		expect(asc[2]?.name).toBe("Gamma Code");

		const desc = applyMarketFilters(mockAgents, {
			q: "",
			tag: null,
			minPrice: null,
			maxPrice: null,
			sort: "price-desc",
			minJobs: 0,
		});
		expect(desc[0]?.name).toBe("Gamma Code");
		expect(desc[2]?.name).toBe("Beta Scout");
	});
});
