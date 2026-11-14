// apps/web/e2e/chats.e2e.ts
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
	balanceWei: "50000000000000000",
	createdAt: "2026-11-12T10:00:00.000Z",
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

function mockChatRoutes(page: Page) {
	const json = (route: Route, status: number, body: unknown) =>
		route.fulfill({
			status,
			contentType: "application/json",
			body: JSON.stringify(body),
		});

	return Promise.all([
		page.route("**/api/agents", (route) =>
			json(route, 200, { agents: [mockAgent] }),
		),
		page.route("**/api/agents/5c1e0a52-0000-4000-8000-000000000001", (route) =>
			json(route, 200, mockAgent),
		),
		page.route("**/api/models", (route) =>
			json(route, 200, {
				models: [
					{
						id: "glm-5.2",
						label: "GLM-5.2",
						toolCalling: true,
						inputPrice: "1000",
						outputPrice: "2000",
					},
				],
			}),
		),
		page.route("**/api/agents/*/chat", (route) =>
			route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: '0:"Hello! I am Scout, your research assistant."\nd:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":12}}\n',
			}),
		),
	]);
}

test.describe("Chat Flows & Accessibility", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockChatRoutes(page);
	});

	test("loads /chats and renders agent start options", async ({ page }) => {
		await page.goto("/chats");
		await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
		await expect(page.getByText("Start a new chat")).toBeVisible();
		await expect(page.getByRole("link", { name: "Scout" })).toBeVisible();
	});

	test("starts a chat turn, streams reply, and displays message", async ({
		page,
	}) => {
		await page.goto("/chats/new?agentId=5c1e0a52-0000-4000-8000-000000000001");
		await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible();

		const composer = page.getByPlaceholder(/Message your agent/i);
		await composer.fill("Hello Scout");
		await page.getByRole("button", { name: "Send" }).click();

		await expect(page.getByText("Hello Scout")).toBeVisible();
		await expect(
			page.getByText("Hello! I am Scout, your research assistant."),
		).toBeVisible();
	});

	test("axe reports no serious or critical accessibility issues on /chats", async ({
		page,
	}) => {
		await page.goto("/chats");
		await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});
});
