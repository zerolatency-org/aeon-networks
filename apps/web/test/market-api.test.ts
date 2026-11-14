// apps/web/test/market-api.test.ts
import { describe, expect, test } from "bun:test";
import {
	buildMarketQuery,
	fetchMarketAgent,
	fetchMarketAgents,
	type MarketQueryParams,
	parseMarketAgent,
} from "@/lib/market-api";
import { ApiError } from "@/lib/siwe-api";

const validAgent = {
	tokenId: "7",
	name: "Scout",
	description: "Web research specialist",
	tags: ["research", "data"],
	price: "1000000000000000",
	owner: "0x1111111111111111111111111111111111111111",
	agentWallet: "0x2222222222222222222222222222222222222222",
	jobsCompleted: 12,
	jobsDisputed: 0,
	totalSettled: "12000000000000000",
	profileHash:
		"0x3333333333333333333333333333333333333333333333333333333333333333",
	hire: {
		chainId: 16602,
		escrow: "0x4444444444444444444444444444444444444444",
		agentPublicKey: "0x04aabbcc",
		verifier: "0x5555555555555555555555555555555555555555",
	},
};

describe("Market API layer", () => {
	test("parseMarketAgent parses valid agent details including hire config", () => {
		const parsed = parseMarketAgent(validAgent);
		expect(parsed).not.toBeNull();
		expect(parsed?.name).toBe("Scout");
		expect(parsed?.tokenId).toBe("7");
		expect(parsed?.hire?.chainId).toBe(16602);
		expect(parsed?.hire?.escrow).toBe(
			"0x4444444444444444444444444444444444444444",
		);
	});

	test("parseMarketAgent allows null hire info", () => {
		const parsed = parseMarketAgent({ ...validAgent, hire: null });
		expect(parsed).not.toBeNull();
		expect(parsed?.hire).toBeNull();
	});

	test("parseMarketAgent rejects malformed agent missing numeric tokenId or price", () => {
		expect(parseMarketAgent({ ...validAgent, tokenId: "invalid" })).toBeNull();
		expect(parseMarketAgent({ ...validAgent, price: "abc" })).toBeNull();
		expect(parseMarketAgent(null)).toBeNull();
		expect(parseMarketAgent({})).toBeNull();
	});

	test("buildMarketQuery converts params to valid query string omitting undefined and empty", () => {
		const params: MarketQueryParams = {
			q: "research",
			tag: "data",
			minPrice: "1000",
			maxPrice: "50000",
			minJobs: 5,
			limit: 10,
			cursor: "cur_123",
		};
		const query = buildMarketQuery(params);
		expect(query).toContain("q=research");
		expect(query).toContain("tag=data");
		expect(query).toContain("minPrice=1000");
		expect(query).toContain("maxPrice=50000");
		expect(query).toContain("minJobs=5");
		expect(query).toContain("limit=10");
		expect(query).toContain("cursor=cur_123");

		const empty = buildMarketQuery({});
		expect(empty).toBe("");
	});

	test("fetchMarketAgents calls endpoint and parses response page", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toContain("/api/market/agents?q=scout&limit=20");
			return new Response(
				JSON.stringify({
					items: [validAgent],
					nextCursor: "next_abc",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		const page = await fetchMarketAgents({ q: "scout" }, mockFetch);
		expect(page.items.length).toBe(1);
		expect(page.items[0]?.name).toBe("Scout");
		expect(page.nextCursor).toBe("next_abc");
	});

	test("fetchMarketAgents throws ApiError on failure", async () => {
		const mockFetch = (async () => {
			return new Response(
				JSON.stringify({ code: "BAD_CURSOR", message: "Invalid cursor" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		expect(fetchMarketAgents({ cursor: "bad" }, mockFetch)).rejects.toThrow(
			ApiError,
		);
	});

	test("fetchMarketAgent calls /api/market/agents/:tokenId and parses agent", async () => {
		const mockFetch = (async (url: string) => {
			expect(url).toBe("/api/market/agents/7");
			return new Response(JSON.stringify(validAgent), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const agent = await fetchMarketAgent("7", mockFetch);
		expect(agent.name).toBe("Scout");
		expect(agent.jobsCompleted).toBe(12);
	});

	test("fetchMarketAgent throws ApiError 404 when agent not found", async () => {
		const mockFetch = (async () => {
			return new Response(
				JSON.stringify({ code: "NOT_FOUND", message: "No such listing" }),
				{ status: 404, headers: { "Content-Type": "application/json" } },
			);
		}) as unknown as typeof fetch;

		expect(fetchMarketAgent("999", mockFetch)).rejects.toThrow(ApiError);
	});
});
