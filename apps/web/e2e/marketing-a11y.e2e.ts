import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/how-it-works"]) {
	test(`${path} has no accessibility violations`, async ({ page }) => {
		await page.goto(path);
		const result = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(result.violations).toEqual([]);
	});
}
