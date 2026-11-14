// apps/web/test/lab.test.ts
import { describe, expect, test } from "bun:test";

import { labEnabled } from "@/lib/lab";

describe("labEnabled", () => {
	test("is open in development and test", () => {
		expect(labEnabled({ NODE_ENV: "development" })).toBe(true);
		expect(labEnabled({ NODE_ENV: "test" })).toBe(true);
	});

	test("is closed in production", () => {
		expect(labEnabled({ NODE_ENV: "production" })).toBe(false);
	});

	test("can be opened on a production build for staging", () => {
		expect(
			labEnabled({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_LAB: "1" }),
		).toBe(true);
		expect(
			labEnabled({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_LAB: "0" }),
		).toBe(false);
	});
});
