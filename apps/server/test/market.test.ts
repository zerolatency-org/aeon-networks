// apps/server/test/market.test.ts
// Marketplace search against seeded rows (no chain needed). The anvil flow that writes
// these rows for real is in integration/market.test.ts.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { profileHash } from "@aeon/api/routers/market";
import { agents } from "@aeon/db/schema/aeon";
import { listings } from "@aeon/db/schema/chain";
import { listingProfiles } from "@aeon/db/schema/market";
import { parseEther } from "viem";

import { setupTestApp } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestApp>>;

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

type Seed = {
	tokenId: number;
	name: string;
	description?: string;
	tags?: string[];
	price: string;
	jobs?: number;
	active?: boolean;
	transferred?: boolean;
};

async function seed(s: Seed) {
	const owner = addr(1000 + s.tokenId);
	const tokenId = BigInt(s.tokenId);
	const profile = {
		tokenId,
		name: s.name,
		description: s.description ?? "",
		tags: s.tags ?? [],
	};
	const hash = profileHash(profile);
	await t.db.insert(agents).values({
		tokenId,
		// a transferred token now belongs to someone other than the lister
		ownerAddress: s.transferred ? addr(9999) : owner,
		name: s.name,
		model: "glm-5.2",
		mintedTx: "0x01",
		mintedBlock: 1n,
	});
	await t.db.insert(listingProfiles).values({
		profileHash: hash,
		...profile,
		tagsText: profile.tags.join(" "),
	});
	await t.db.insert(listings).values({
		tokenId,
		listedBy: owner,
		agentWallet: addr(2000 + s.tokenId),
		price: parseEther(s.price),
		active: s.active ?? true,
		profileHash: hash,
		jobsCompleted: s.jobs ?? 0,
		updatedBlock: 1n,
	});
}

type Item = { tokenId: string; name: string; price: string; tags: string[] };
type Page = { items: Item[]; nextCursor: string | null };

async function search(params: Record<string, string | number> = {}) {
	const qs = new URLSearchParams(
		Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]),
	);
	const res = await t.app.request(`/api/market/agents?${qs}`);
	expect(res.status).toBe(200);
	return (await res.json()) as Page;
}
const ids = (p: Page) => p.items.map((i) => i.tokenId);

beforeAll(async () => {
	t = await setupTestApp();
	await seed({
		tokenId: 1,
		name: "Research Scout",
		description: "Finds and summarises papers",
		tags: ["research", "papers"],
		price: "0.01",
		jobs: 5,
	});
	await seed({
		tokenId: 2,
		name: "Code Reviewer",
		description: "Reviews TypeScript pull requests",
		tags: ["code"],
		price: "0.02",
		jobs: 5,
	});
	await seed({
		tokenId: 3,
		name: "Translator",
		description: "English to Hindi",
		tags: ["language"],
		price: "0.005",
		jobs: 1,
	});
	await seed({ tokenId: 4, name: "Gone Quiet", price: "0.01", active: false });
	await seed({
		tokenId: 5,
		name: "Sold Off",
		price: "0.01",
		transferred: true,
	});
	// three exact ties: same jobs, same price
	for (const tokenId of [9, 7, 8]) {
		await seed({ tokenId, name: `Twin ${tokenId}`, price: "0.03", jobs: 0 });
	}
});
afterAll(() => t.close());

describe("market search", () => {
	test("inactive and transferred listings never appear, in search or by id", async () => {
		const all = ids(await search({ limit: 50 }));
		expect(all).not.toContain("4");
		expect(all).not.toContain("5");
		expect((await t.app.request("/api/market/agents/4")).status).toBe(404);
		expect((await t.app.request("/api/market/agents/5")).status).toBe(404);
		expect((await t.app.request("/api/market/agents/1")).status).toBe(200);
	});

	test("ranks by completed jobs, then price, then token id", async () => {
		expect(ids(await search({ limit: 50 }))).toEqual([
			"1", // 5 jobs, 0.01
			"2", // 5 jobs, 0.02
			"3", // 1 job
			"7", // 0 jobs, 0.03: ties ordered by token id
			"8",
			"9",
		]);
	});

	test("paging walks every row exactly once, and ties stay in the same order", async () => {
		const seen: string[] = [];
		let cursor: string | null = null;
		do {
			const page: Page = await search(
				cursor ? { limit: 2, cursor } : { limit: 2 },
			);
			seen.push(...ids(page));
			cursor = page.nextCursor;
		} while (cursor);
		expect(seen).toEqual(["1", "2", "3", "7", "8", "9"]);
		expect(ids(await search({ limit: 50 }))).toEqual(seen);
	});

	test("text search matches name, description and tags", async () => {
		expect(ids(await search({ q: "scout" }))).toEqual(["1"]);
		expect(ids(await search({ q: "typescript" }))).toEqual(["2"]);
		expect(ids(await search({ q: "papers" }))).toEqual(["1"]);
		expect(ids(await search({ q: "nothing-like-this" }))).toEqual([]);
	});

	test("filters by tag, price range and minimum track record", async () => {
		expect(ids(await search({ tag: "code" }))).toEqual(["2"]);
		expect(
			ids(
				await search({
					minPrice: parseEther("0.006").toString(),
					maxPrice: parseEther("0.02").toString(),
				}),
			),
		).toEqual(["1", "2"]);
		expect(ids(await search({ minJobs: 1 }))).toEqual(["1", "2", "3"]);
	});

	test("a malformed cursor is a 400", async () => {
		const res = await t.app.request("/api/market/agents?cursor=not-a-cursor");
		expect(res.status).toBe(400);
	});

	test("GET /market/min-price returns minimum listing price", async () => {
		const res = await t.app.request("/api/market/min-price");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toHaveProperty("minPriceWei");
		expect(typeof body.minPriceWei).toBe("string");
	});
});
