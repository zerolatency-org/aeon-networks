import { expect, test } from "@playwright/test";
import { budgetProblems, gzipBytes, isThreeChunk, kb } from "./budget";

test("landing JavaScript stays within budget", async ({ page }) => {
	test.skip(process.env.CI !== "true", "Production budget is measured in CI");
	const base: number[] = [];
	const three: number[] = [];
	await page.route("**/_next/static/**/*.js", async (route) => {
		const response = await route.fetch();
		const body = await response.body();
		(isThreeChunk(body) ? three : base).push(gzipBytes(body));
		await route.fulfill({ response, body });
	});
	await page.goto("/");
	await page.waitForLoadState("load");
	await page.waitForTimeout(4000);
	const sizes = {
		baseBytes: base.reduce((a, b) => a + b, 0),
		threeBytes: three.length ? three.reduce((a, b) => a + b, 0) : null,
	};
	test.info().annotations.push({
		type: "sizes",
		description: `landing ${kb(sizes.baseBytes)} KB, 3D ${sizes.threeBytes === null ? "not requested" : `${kb(sizes.threeBytes)} KB`} gzip`,
	});
	expect(budgetProblems(sizes)).toEqual([]);
});
