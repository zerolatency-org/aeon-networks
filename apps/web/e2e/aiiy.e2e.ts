// apps/web/e2e/a11y.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { injectWallet, mockApi, ownedWallet, walletUser } from "./support";

async function seriousProblems(page: Page): Promise<string[]> {
	const results = await new AxeBuilder({ page }).analyze();
	return results.violations
		.filter((v) => v.impact === "serious" || v.impact === "critical")
		.map(
			(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
		);
}

const signedIn = {
	user: walletUser,
	wallets: [ownedWallet],
	accounts: [{ providerId: "google" }],
};

for (const theme of ["dark", "light"] as const) {
	test.describe(`${theme} theme`, () => {
		test.beforeEach(async ({ page }) => {
			await page.addInitScript((t) => {
				try {
					localStorage.setItem("theme", t);
				} catch {
					// storage can be blocked; the default theme is dark
				}
			}, theme);
			await injectWallet(page);
		});

		test("axe finds no serious or critical problems on /login", async ({
			page,
		}) => {
			await mockApi(page);
			await page.goto("/login");
			await expect(page.locator("html")).toHaveClass(
				new RegExp(`\\b${theme}\\b`),
			);
			await expect(
				page.getByRole("button", { name: "Continue with wallet" }),
			).toBeVisible();
			expect(await seriousProblems(page)).toEqual([]);
		});

		test("axe finds no serious or critical problems on /settings", async ({
			page,
		}) => {
			await mockApi(page, signedIn);
			await page.goto("/settings");
			await expect(
				page.getByRole("heading", { name: "Sign-in methods" }),
			).toBeVisible();
			await expect(page.getByText("Linked", { exact: true })).toBeVisible();
			expect(await seriousProblems(page)).toEqual([]);
		});

		test("axe finds no serious or critical problems on the navbar and balance dropdown", async ({
			page,
		}) => {
			await mockApi(page, signedIn);
			await page.goto("/agents");
			const pill = page.getByRole("button", { name: "Wallet and balance" });
			await expect(pill).toContainText("1.42 0G");
			await pill.click();
			await expect(page.getByText("Agent wallets")).toBeVisible();
			expect(await seriousProblems(page)).toEqual([]);
		});
	});
}
