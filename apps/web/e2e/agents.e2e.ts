// apps/web/e2e/agents.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";

import { injectWallet, mockApi, ownedWallet, walletUser } from "./support";

const mockAgent = {
	id: "5c1e0a52-0000-4000-8000-000000000001",
	tokenId: "7",
	name: "Scout",
	description: "Finds research papers",
	model: "glm-5.2",
	status: "active",
	avatarKind: "preset",
	avatarRef: "p03",
	agentWallet: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	balanceWei: "50000000000000000",
	createdAt: "2026-11-12T10:00:00.000Z",
};

const mockModels = [
	{
		id: "glm-5.2",
		label: "GLM-5.2",
		toolCalling: true,
		inputPrice: "1000",
		outputPrice: "2000",
	},
	{
		id: "qwen-2.5-coder",
		label: "Qwen 2.5 Coder",
		toolCalling: true,
		inputPrice: "500",
		outputPrice: "1000",
	},
];

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

function mockAgentRoutes(page: Page, agentsList: unknown[] = [mockAgent]) {
	const json = (route: Route, status: number, body: unknown) =>
		route.fulfill({
			status,
			contentType: "application/json",
			body: JSON.stringify(body),
		});

	return Promise.all([
		page.route("**/api/models", (route) =>
			json(route, 200, { models: mockModels }),
		),
		page.route("**/api/market/min-price", (route) =>
			json(route, 200, { minPriceWei: "1000000000000000" }),
		),
		page.route("**/api/agents", (route) => {
			if (route.request().method() === "GET") {
				return json(route, 200, { agents: agentsList });
			}
			return json(route, 404, { code: "NOT_FOUND" });
		}),
		page.route("**/api/agents/5c1e0a52-0000-4000-8000-000000000001", (route) =>
			json(route, 200, mockAgent),
		),
		page.route(
			"**/api/agents/5c1e0a52-0000-4000-8000-000000000001/policy",
			(route) =>
				json(route, 200, {
					perJobCap: "10000000000000000",
					dailyCap: "50000000000000000",
					minJobsCompleted: 0,
					maxHireDepth: 1,
					evaluatorMode: "own_agent",
				}),
		),
	]);
}

test.describe("Agents Grid and Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
	});

	test("empty state shows when user has no agents", async ({ page }) => {
		await mockApi(page, signedIn);
		await mockAgentRoutes(page, []);
		await page.goto("/agents");

		await expect(
			page.getByRole("heading", { name: "No agents yet" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "New agent" })).toBeVisible();
	});

	test("shows agent card and links to detail page", async ({ page }) => {
		await mockApi(page, signedIn);
		await mockAgentRoutes(page, [mockAgent]);
		await page.goto("/agents");

		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		await expect(page.getByText("glm-5.2")).toBeVisible();
		await expect(page.getByText("0.05 0G")).toBeVisible();
		await expect(page.getByText("Funded")).toBeVisible();

		await page.getByRole("link", { name: /Scout/ }).click();
		await expect(page).toHaveURL(
			/\/agents\/5c1e0a52-0000-4000-8000-000000000001/,
		);
	});
});

test.describe("Mint Wizard /agents/new", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockAgentRoutes(page, []);
	});

	test("steps through Identity, Persona, Limits, and Review", async ({
		page,
	}) => {
		await page.goto("/agents/new");

		await expect(
			page.getByRole("heading", { name: "New agent" }),
		).toBeVisible();
		await expect(page.getByLabel("Name")).toBeVisible();

		// Step 1: Identity
		await page.getByLabel("Name").fill("Archon");
		await page.getByLabel("Face p02").click();
		await page.getByRole("button", { name: "Next" }).click();

		// Step 2: Persona & Model
		await expect(
			page.getByRole("button", { name: "Research assistant" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Research assistant" }).click();
		await expect(page.getByLabel("Persona")).not.toHaveValue("");
		await page.getByRole("button", { name: "Next" }).click();

		// Step 3: Limits
		await expect(page.getByText("Default limits")).toBeVisible();
		await page.getByRole("button", { name: "Next" }).click();

		// Step 4: Review
		await expect(
			page.getByRole("button", { name: "Mint agent" }),
		).toBeVisible();
		await expect(page.getByText("Archon")).toBeVisible();
	});
});

test.describe("Agent Detail Page /agents/[id]", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockAgentRoutes(page, [mockAgent]);
	});

	test("renders overview numbers and tab bar", async ({ page }) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001");

		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		await expect(page.getByText("Active")).toBeVisible();
		await expect(page.getByText("0.05 0G")).toBeVisible();

		// Tabs navigation
		await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Wallet" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Listing" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Policy" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Memory" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
	});

	test("switches between tabs and updates address query", async ({ page }) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001");

		// Wallet Tab
		await page.getByRole("link", { name: "Wallet" }).click();
		await expect(page).toHaveURL(/\?tab=wallet/);
		await expect(page.getByText("Agent wallet & funding")).toBeVisible();

		// Listing Tab
		await page.getByRole("link", { name: "Listing" }).click();
		await expect(page).toHaveURL(/\?tab=listing/);
		await expect(
			page.getByRole("heading", { name: "Marketplace listing" }),
		).toBeVisible();
		await expect(page.getByText("Understanding the four prices")).toBeVisible();

		// Policy Tab
		await page.getByRole("link", { name: "Policy" }).click();
		await expect(page).toHaveURL(/\?tab=policy/);
		await expect(
			page.getByRole("heading", { name: "Spending limits & policy" }),
		).toBeVisible();

		// Memory Tab
		await page.getByRole("link", { name: "Memory" }).click();
		await expect(page).toHaveURL(/\?tab=memory/);
		await expect(page.getByText("No memory entries yet")).toBeVisible();

		// Activity Tab
		await page.getByRole("link", { name: "Activity" }).click();
		await expect(page).toHaveURL(/\?tab=activity/);
		await expect(page.getByText("No activity recorded yet")).toBeVisible();
	});
});

test.describe("Accessibility (Axe)", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockAgentRoutes(page, [mockAgent]);
	});

	test("axe finds no serious or critical problems on /agents", async ({
		page,
	}) => {
		await page.goto("/agents");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});

	test("axe finds no serious or critical problems on /agents/new", async ({
		page,
	}) => {
		await page.goto("/agents/new");
		await expect(
			page.getByRole("heading", { name: "New agent" }),
		).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});

	test("axe finds no serious or critical problems on /agents/[id]", async ({
		page,
	}) => {
		await page.goto("/agents/5c1e0a52-0000-4000-8000-000000000001");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});
});
