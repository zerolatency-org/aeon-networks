// apps/web/test/format.test.ts
import { describe, expect, test } from "bun:test";

import { formatOg, shortAddress } from "@/lib/format";

describe("formatOg", () => {
	test("formats whole and fractional amounts and groups thousands", () => {
		expect(formatOg(0n)).toBe("0");
		expect(formatOg(1_420_000_000_000_000_000n)).toBe("1.42");
		expect(formatOg(1_234_567_000_000_000_000_000_000n)).toBe("1,234,567");
	});

	test("cuts extra digits instead of rounding up, so it never shows more than you have", () => {
		expect(formatOg(1_999_999_999_999_999_999n)).toBe("1.9999");
	});

	test("shows a marker for an amount too small to display", () => {
		expect(formatOg(1n)).toBe("<0.0001");
	});
});

describe("shortAddress", () => {
	test("keeps the first five and last four characters", () => {
		expect(shortAddress("0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2aB")).toBe(
			"0x3eb…a2aB",
		);
	});

	test("returns anything that is not an address unchanged", () => {
		expect(shortAddress("vitalik.eth")).toBe("vitalik.eth");
		expect(shortAddress("")).toBe("");
	});
});
