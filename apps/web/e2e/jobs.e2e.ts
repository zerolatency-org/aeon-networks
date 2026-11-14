// apps/web/e2e/jobs.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route, test } from "@playwright/test";

import { injectWallet, mockApi, ownedWallet, walletUser } from "./support";

const mockJob = {
	jobId: "101",
	tokenId: "7",
	state: "funded",
	client: "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab",
	payee: "0x1111111111111111111111111111111111111111",
	evaluator: "0x2222222222222222222222222222222222222222",
	amount: "10000000000000000",
	taskHash:
		"0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
	resultHash: null,
	expiredAt: "2026-11-20T12:00:00.000Z",
	acceptWindowS: 3600,
	submittedAt: null,
	settledAt: null,
	roles: ["client"],
	deliveries: ["task"],
	providerRun: { status: "running", errorCode: null },
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

function mockJobsRoutes(page: Page) {
	const json = (route: Route, status: number, body: unknown) =>
		route.fulfill({
			status,
			contentType: "application/json",
			body: JSON.stringify(body),
		});

	return Promise.all([
		page.route("**/api/jobs", (route) => {
			if (route.request().method() === "GET") {
				return json(route, 200, { jobs: [mockJob] });
			}
			return json(route, 404, {});
		}),
		page.route("**/api/jobs/101", (route) => json(route, 200, mockJob)),
		page.route("**/api/jobs/101/verdict", (route) =>
			json(route, 404, { code: "NOT_FOUND" }),
		),
	]);
}

test.describe("Jobs Flows & Accessibility", () => {
	test.beforeEach(async ({ page }) => {
		await injectWallet(page);
		await mockApi(page, signedIn);
		await mockJobsRoutes(page);
	});

	test("loads /jobs and renders job cards with escrow details", async ({
		page,
	}) => {
		await page.goto("/jobs");
		await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Job #101" })).toBeVisible();
		await expect(page.getByText("0.01 0G")).toBeVisible();
	});

	test("opens /jobs/101 and renders timeline and addresses", async ({
		page,
	}) => {
		await page.goto("/jobs/101");
		await expect(page.getByRole("heading", { name: "Job #101" })).toBeVisible();
		await expect(page.getByText("Job Lifecycle Timeline")).toBeVisible();
		await expect(page.getByText("Escrow Funded")).toBeVisible();
		await expect(page.getByText("Sub-Job Delegation Tree")).toBeVisible();
	});

	test("axe finds no serious or critical accessibility issues on /jobs", async ({
		page,
	}) => {
		await page.goto("/jobs");
		await expect(page.getByRole("heading", { name: "Job #101" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});

	test("axe finds no serious or critical accessibility issues on /jobs/101", async ({
		page,
	}) => {
		await page.goto("/jobs/101");
		await expect(page.getByRole("heading", { name: "Job #101" })).toBeVisible();
		expect(await seriousProblems(page)).toEqual([]);
	});
});
