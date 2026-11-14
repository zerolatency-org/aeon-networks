// apps/web/test/tokens.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastRatio } from "@/lib/contrast";
import { COLOR_TOKENS, MEANING_TOKENS } from "@/lib/tokens";

const tokensCss = readFileSync(
	join(import.meta.dir, "../src/styles/tokens.css"),
	"utf8",
);

/** Text between `selector {` and its closing brace. The blocks have no nesting. */
function block(css: string, selector: string): string {
	const start = css.indexOf(`${selector} {`);
	if (start === -1) throw new Error(`No block for ${selector}`);
	return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
}

function colors(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
		out[m[1] as string] = m[2] as string;
	}
	return out;
}

const themes = {
	light: colors(block(tokensCss, ":root,\n.light")),
	dark: colors(block(tokensCss, ".dark")),
} as const;

describe("color tokens", () => {
	for (const [name, set] of Object.entries(themes)) {
		test(`${name} defines every token as a 6-digit hex`, () => {
			for (const token of COLOR_TOKENS) {
				expect(set[token], `${name} is missing --${token}`).toMatch(
					/^#[0-9a-fA-F]{6}$/,
				);
			}
		});
	}

	test("both themes name exactly the same tokens", () => {
		expect(Object.keys(themes.light).sort()).toEqual(
			Object.keys(themes.dark).sort(),
		);
	});

	test("lumen fill and ink are the same in both themes", () => {
		expect(themes.light.lumen).toBe(themes.dark.lumen);
		expect(themes.light["lumen-ink"]).toBe(themes.dark["lumen-ink"]);
	});
});

describe("contrast", () => {
	for (const [name, set] of Object.entries(themes)) {
		const page = set.canvas as string;
		const card = set["surface-1"] as string;

		test(`${name}: body text reaches 7:1 on the page and on cards`, () => {
			expect(contrastRatio(set.text as string, page)).toBeGreaterThanOrEqual(7);
			expect(contrastRatio(set.text as string, card)).toBeGreaterThanOrEqual(7);
		});

		test(`${name}: secondary text reaches 4.5:1 on the page and on cards`, () => {
			expect(
				contrastRatio(set["text-2"] as string, page),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrastRatio(set["text-2"] as string, card),
			).toBeGreaterThanOrEqual(4.5);
		});

		test(`${name}: hint text reaches 4.5:1 on the page`, () => {
			expect(
				contrastRatio(set["text-3"] as string, page),
			).toBeGreaterThanOrEqual(4.5);
		});

		test(`${name}: lumen text and every meaning color reach 4.5:1 on the page`, () => {
			expect(
				contrastRatio(set["lumen-fg"] as string, page),
			).toBeGreaterThanOrEqual(4.5);
			for (const token of MEANING_TOKENS) {
				expect(
					contrastRatio(set[token] as string, page),
					`${name} --${token}`,
				).toBeGreaterThanOrEqual(4.5);
			}
		});

		test(`${name}: ink on the lumen fill reaches 7:1`, () => {
			expect(
				contrastRatio(set["lumen-ink"] as string, set.lumen as string),
			).toBeGreaterThanOrEqual(7);
		});
	}
});
