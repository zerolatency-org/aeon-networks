// apps/web/test/listing-form.test.ts
import { describe, expect, test } from "bun:test";

import {
	checkPrice,
	DEFAULT_MIN_PRICE,
	priceProblem,
} from "@/lib/listing-form";
import { parseOg } from "@/lib/policy-form";
import { ApiError } from "@/lib/siwe-api";

const og = (n: string) => parseOg(n)!;

describe("checkPrice against market minimum", () => {
	const minPrice = og("0.001");

	test("a price at or above the registry minimum is valid", () => {
		expect(checkPrice("0.001", minPrice)).toEqual({ ok: true, wei: minPrice });
		expect(checkPrice("0.05", minPrice)).toEqual({ ok: true, wei: og("0.05") });
		expect(checkPrice("1", minPrice)).toEqual({ ok: true, wei: og("1") });
		expect(DEFAULT_MIN_PRICE).toBe(1000000000000000n);
	});

	test("a price below the registry minimum is refused with plain words", () => {
		const res = checkPrice("0.0005", minPrice);
		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.message).toBe("Price must be at least 0.001 0G.");
		}
	});

	test("blank, zero or malformed amounts are refused with helpful advice", () => {
		expect(checkPrice("", minPrice)).toEqual({
			ok: false,
			message: "Enter a price in 0G.",
		});
		expect(checkPrice("   ", minPrice)).toEqual({
			ok: false,
			message: "Enter a price in 0G.",
		});
		expect(checkPrice("0", minPrice)).toEqual({
			ok: false,
			message: "Enter more than zero.",
		});
		expect(checkPrice("abc", minPrice)).toEqual({
			ok: false,
			message: "Enter a valid price in 0G, like 0.05.",
		});
		expect(checkPrice("-1", minPrice)).toEqual({
			ok: false,
			message: "Enter a valid price in 0G, like 0.05.",
		});
	});
});

describe("priceProblem", () => {
	test("known backend errors give friendly messages", () => {
		expect(priceProblem(new ApiError("PRICE_TOO_LOW", 400))).toBe(
			"Price is below the registry minimum.",
		);
		expect(priceProblem(new ApiError("NOT_MINED", 409))).toBe(
			"Transaction is still pending on chain.",
		);
		expect(priceProblem(new ApiError("TX_FAILED", 400))).toBe(
			"The listing transaction failed on chain.",
		);
		expect(priceProblem(new Error("User rejected"))).toBe("User rejected");
		expect(priceProblem(null)).toBe("Could not update listing.");
	});
});
