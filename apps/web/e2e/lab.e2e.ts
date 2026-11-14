// apps/web/e2e/lab.e2e.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const SECTIONS = [
	"Color",
	"Type",
	"Buttons",
	"Badges",
	"Bento grid",
	"Glass",
	"Spinners",
	"Skeletons",
	"Motion",
];

const themeSwitch = (page: Page) =>
	page.getByRole("button", { name: "Switch theme" });

test("opens in the dark theme with every section", async ({ page }) => {
	await page.goto("/lab");
	await expect(page.locator("html")).toHaveClass(/\bdark\b/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Component lab" }),
	).toBeVisible();
	for (const name of SECTIONS) {
		await expect(
			page.getByRole("heading", { level: 2, name, exact: true }),
		).toBeVisible();
	}
});

test("the theme switch flips to light and survives a reload", async ({
	page,
}) => {
	await page.goto("/lab");
	await themeSwitch(page).click();
	await expect(page.locator("html")).toHaveClass(/\blight\b/);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("theme")))
		.toBe("light");

	await page.reload();
	await expect(page.locator("html")).toHaveClass(/\blight\b/);
});

test.describe("reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("switches theme at once, with no view transition", async ({ page }) => {
		await page.goto("/lab");
		await themeSwitch(page).click();
		await expect(page.locator("html")).toHaveClass(/\blight\b/);

		const transitions = await page.evaluate(
			() =>
				document.documentElement
					.getAnimations({ subtree: true })
					.filter((a) =>
						(
							(a.effect as KeyframeEffect | null)?.pseudoElement ?? ""
						).startsWith("::view-transition"),
					).length,
		);
		expect(transitions).toBe(0);
	});
});

for (const theme of ["dark", "light"] as const) {
	test(`axe finds no serious or critical problems in ${theme}`, async ({
		page,
	}) => {
		await page.addInitScript((t) => {
			try {
				localStorage.setItem("theme", t);
			} catch {
				// storage can be blocked; the default theme is dark
			}
		}, theme);
		await page.goto("/lab");
		await expect(page.locator("html")).toHaveClass(
			new RegExp(`\\b${theme}\\b`),
		);

		const results = await new AxeBuilder({ page }).analyze();
		const serious = results.violations.filter(
			(v) => v.impact === "serious" || v.impact === "critical",
		);
		expect(
			serious.map(
				(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
			),
		).toEqual([]);
	});
}

test("loads with no console errors", async ({ page }) => {
	const problems: string[] = [];
	page.on("console", (m) => {
		// The favicon arrives in F8; its 404 is not a bug in F0.
		if (m.type() === "error" && !m.location().url.includes("favicon"))
			problems.push(m.text());
	});
	page.on("pageerror", (e) => problems.push(e.message));

	await page.goto("/lab");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	expect(problems).toEqual([]);
});
