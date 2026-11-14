import { expect, test } from "@playwright/test";

test("landing presents the hero and story link", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { level: 1, name: "Agents that hire agents." }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "How it works" })).toBeVisible();
});
test("story presents three scenes and ten loop steps", async ({ page }) => {
	await page.goto("/how-it-works");
	await expect(
		page.getByRole("heading", { name: "How Aeon works" }),
	).toBeVisible();
	await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
	await expect(
		page.locator('section[aria-labelledby="loop-title"] li'),
	).toHaveCount(10);
});
