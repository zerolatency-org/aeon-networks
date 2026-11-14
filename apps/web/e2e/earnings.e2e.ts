// apps/web/e2e/earnings.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";

import { injectWallet, mockApi, ownedWallet, walletUser } from "./support";

const mockAgent = {
	id: "5c1e0a52-0000-4000-8000-000000000001",
	tokenId: "7",
	name: "Scout",
	description: "Web research specialist",
	model: "glm-5.2",
	status: "active",
	avatarKind: "preset",
	avatarRef: "p03",
	agentWallet: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	balanceWei: "50000000000000000", // 0.05 0G
	createdAt: "2026-11-12T10:00:00.000Z",
};

const mockListing = {
	tokenId: "7",
	name: "Scout",
	description: "Web research specialist",
	tags: ["research"],
	price: "1000000000000000",
	owner: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	jobsCompleted: 15,
	jobsDisputed: 0,
	totalSettled: "250000000000000000", // 0.25 0G
};

const signedIn = {
	user: walletUser,
	wallets: [ownedWallet],
	accounts: [{ providerId: "google" }],
};

async function seriousProblems(page: Page): Promise<string[]> {
	const results = await new AxeBuilder({ page }).analyze();
	return results.violations
		.filter((v) => v.impact === "serious" || v.impact === "critical")
		.map(
			(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
		);
}

function mockAgentRoutes(page: Page) {
	const json = (route: Route, status: number, body: unknown) =>
		route.fulfill({
			status,
			contentType: "application/json",
			body: JSON.stringify(body),
		});

	return Promise.all([
		page.route("**/api/agents/5c1e0a52-0000-4000-8000-000000000001", (route) =>
			json(route, 200, mockAgent),
		),
		page.route("**/api/market/agents/7", (route) =>
			json(route, 200, mockListing),
		),
		page.route("**/api/jobs", (route) => json(route, 200, { jobs: [] })),
	]);
}

test.describe("Earnings, Memory & Activity Tabs", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockAgentRoutes(page);
	});

	test("overview displays settled earnings and jobs finished from listing", async ({
		page,
	}) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		await expect(page.getByText("0.25 0G")).toBeVisible();
		await expect(page.getByText("15", { exact: true })).toBeVisible();
	});

	test("wallet tab renders sweep section with max sweepable amount", async ({
		page,
	}) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001?tab=wallet");
		await expect(
			page.getByRole("heading", { name: "Sweep earnings" }),
		).toBeVisible();
		await expect(page.getByText("Max Sweepable:")).toBeVisible();
		await expect(page.getByText("0.045 0G")).toBeVisible();
	});

	test("memory tab allows adding and viewing memories", async ({ page }) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001?tab=memory");
		await expect(page.getByText("Agent memory")).toBeVisible();
		await page.getByRole("button", { name: "+ Add context fact" }).click();

		await page.getByLabel("Title").fill("New Guideline");
		await page
			.getByLabel(/Fact \/ Guideline Context/i)
			.fill("Test context note");
		await page.getByRole("button", { name: "Save to memory" }).click();

		await expect(page.getByText("New Guideline")).toBeVisible();
	});

	test("activity tab renders activity log without axe violations", async ({
		page,
	}) => {
		await page.goto(
			"/agents/5c1e0a52-0000-4000-8000-000000000001?tab=activity",
		);
		await expect(page.getByText("Activity log")).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});
});
