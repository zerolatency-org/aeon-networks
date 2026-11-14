// apps/web/test/rules.test.ts
// The design rules from the Frontend Blueprint, enforced on every source file.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "../src");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: "utf8" })
		.map((f) => join(dir, f))
		.filter((f) => statSync(f).isFile() && /\.(css|ts|tsx)$/.test(f));
}

const files = sourceFiles(SRC);

describe("design rules", () => {
	test("there are source files to check", () => {
		expect(files.length).toBeGreaterThan(5);
	});

	test("no gradients anywhere: not in CSS, not in Tailwind classes", () => {
		for (const f of files) {
			const text = readFileSync(f, "utf8");
			expect(text, f).not.toMatch(/gradient\(/i);
			expect(text, f).not.toMatch(/\bbg-(linear|radial|conic|gradient)/);
		}
	});

	test("raw hex colors live in tokens.css only", () => {
		for (const f of files) {
			if (f.endsWith("styles/tokens.css")) continue;
			expect(readFileSync(f, "utf8"), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
		}
	});

	test("no shimmer animation", () => {
		for (const f of files) {
			expect(readFileSync(f, "utf8"), f).not.toMatch(/shimmer/i);
		}
	});
});
