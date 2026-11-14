// apps/web/e2e/market.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";

import { injectWallet, mockApi, ownedWallet, walletUser } from "./support";

const mockMarketAgent = {
	tokenId: "7",
	name: "Scout",
	description: "Web research specialist and data extractor",
	tags: ["research", "data"],
	price: "1000000000000000", // 0.001 0G
	owner: "0x1111111111111111111111111111111111111111",
	agentWallet: "0x2222222222222222222222222222222222222222",
	jobsCompleted: 14,
	jobsDisputed: 0,
	totalSettled: "14000000000000000",
	profileHash:
		"0x3333333333333333333333333333333333333333333333333333333333333333",
	hire: {
		chainId: 16602,
		escrow: "0x4444444444444444444444444444444444444444",
		agentPublicKey: "0x04aabbcc",
		verifier: "0x5555555555555555555555555555555555555555",
	},
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

function mockMarketRoutes(page: Page) {
	const json = (route: Route, status: number, body: unknown) =>
		route.fulfill({
			status,
			contentType: "application/json",
			body: JSON.stringify(body),
		});

	return Promise.all([
		page.route("**/api/market/agents?*", (route) =>
			json(route, 200, {
				items: [mockMarketAgent],
				nextCursor: null,
			}),
		),
		page.route("**/api/market/agents", (route) =>
			json(route, 200, {
				items: [mockMarketAgent],
				nextCursor: null,
			}),
		),
		page.route("**/api/market/agents/7", (route) =>
			json(route, 200, mockMarketAgent),
		),
	]);
}

test.describe("Marketplace Flows & Accessibility", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockMarketRoutes(page);
	});

	test("loads /market and renders agent cards with trust badge", async ({
		page,
	}) => {
		await page.goto("/market");
		await expect(
			page.getByRole("heading", { name: "Agent Marketplace" }),
		).toBeVisible();
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		await expect(page.getByText("Clean record")).toBeVisible();
		await expect(page.getByText("0.001 0G")).toBeVisible();
	});

	test("navigates to agent detail page /market/7 and displays details", async ({
		page,
	}) => {
		await page.goto("/market");
		await page.getByRole("link", { name: "Scout #7" }).click();
		await expect(page).toHaveURL("/market/7");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		await expect(page.getByText("About this agent")).toBeVisible();
		await expect(
			page.getByRole("button", { name: /Hire agent/i }),
		).toBeVisible();
	});

	test("axe reports no serious or critical accessibility issues on /market", async ({
		page,
	}) => {
		await page.goto("/market");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});

	test("axe reports no serious or critical accessibility issues on /market/7", async ({
		page,
	}) => {
		await page.goto("/market/7");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});
});
