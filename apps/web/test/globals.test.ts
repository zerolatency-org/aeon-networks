// apps/web/test/globals.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DURATION, EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

const globalsCss = readFileSync(
	join(import.meta.dir, "../src/styles/globals.css"),
	"utf8",
);

function cssVar(name: string): string {
	const m = globalsCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
	if (!m) throw new Error(`--${name} not found in globals.css`);
	return (m[1] as string).trim();
}

describe("motion tokens", () => {
	test("durations in CSS and in motion.ts are equal", () => {
		expect(Number.parseInt(cssVar("dur-fast"), 10) / 1000).toBe(DURATION.fast);
		expect(Number.parseInt(cssVar("dur-base"), 10) / 1000).toBe(DURATION.base);
		expect(Number.parseInt(cssVar("dur-slow"), 10) / 1000).toBe(DURATION.slow);
		expect(Number.parseInt(cssVar("dur-story"), 10) / 1000).toBe(
			DURATION.story,
		);
	});

	test("easing curves in CSS and in motion.ts are equal", () => {
		expect(cssVar("ease-out")).toBe(`cubic-bezier(${EASE_OUT.join(", ")})`);
		expect(cssVar("ease-in-out")).toBe(
			`cubic-bezier(${EASE_IN_OUT.join(", ")})`,
		);
	});
});

describe("accessibility fallbacks", () => {
	test("glass has an opaque fallback for reduced transparency", () => {
		expect(globalsCss).toContain("prefers-reduced-transparency");
	});

	test("reduced motion shortens animations and stops spinners", () => {
		expect(globalsCss).toContain("prefers-reduced-motion");
		expect(globalsCss).toContain("animation-iteration-count: 1 !important");
	});
});
