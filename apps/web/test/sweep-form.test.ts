// apps/web/test/sweep-form.test.ts
import { describe, expect, test } from "bun:test";
import {
	checkSweepAmount,
	DEFAULT_GAS_RESERVE,
	maxSweepable,
	quickSweepAmounts,
} from "@/lib/sweep-form";

// 0.05 0G = 50000000000000000n wei
const balance = 50000000000000000n;
// default gas reserve = 0.005 0G = 5000000000000000n wei

describe("Sweep earnings rules & gas reserve", () => {
	test("maxSweepable subtracts gas reserve from balance", () => {
		const max = maxSweepable(balance, DEFAULT_GAS_RESERVE);
		// 0.05 - 0.005 = 0.045 0G = 45000000000000000n
		expect(max).toBe(45000000000000000n);
	});

	test("maxSweepable returns 0n if balance is less than or equal to gas reserve", () => {
		expect(maxSweepable(3000000000000000n, DEFAULT_GAS_RESERVE)).toBe(0n);
		expect(maxSweepable(DEFAULT_GAS_RESERVE, DEFAULT_GAS_RESERVE)).toBe(0n);
	});

	test("checkSweepAmount validates typed amount within sweepable bounds", () => {
		const res = checkSweepAmount("0.02", balance, DEFAULT_GAS_RESERVE);
		expect(res.ok).toBe(true);
		expect(res.wei).toBe(20000000000000000n);
	});

	test("checkSweepAmount rejects empty, zero, or negative inputs", () => {
		expect(checkSweepAmount("", balance).ok).toBe(false);
		expect(checkSweepAmount("0", balance).ok).toBe(false);
		expect(checkSweepAmount("-0.01", balance).ok).toBe(false);
		expect(checkSweepAmount("abc", balance).ok).toBe(false);
	});

	test("checkSweepAmount rejects amount exceeding max sweepable", () => {
		// Trying to sweep 0.048 when max is 0.045
		const res = checkSweepAmount("0.048", balance, DEFAULT_GAS_RESERVE);
		expect(res.ok).toBe(false);
		expect(res.message).toContain("gas reserve");
	});

	test("checkSweepAmount informs user if balance is entirely below gas reserve", () => {
		const res = checkSweepAmount(
			"0.001",
			3000000000000000n,
			DEFAULT_GAS_RESERVE,
		);
		expect(res.ok).toBe(false);
		expect(res.message).toContain("No sweepable funds");
	});

	test("quickSweepAmounts provides 25%, 50%, and 100% options of sweepable amount", () => {
		const quick = quickSweepAmounts(balance, DEFAULT_GAS_RESERVE);
		expect(quick.length).toBe(3);
		expect(quick[0]?.percent).toBe(25);
		expect(quick[1]?.percent).toBe(50);
		expect(quick[2]?.percent).toBe(100);
		expect(quick[2]?.wei).toBe(45000000000000000n); // 100% of sweepable
	});

	test("quickSweepAmounts returns empty array if no funds are sweepable", () => {
		const quick = quickSweepAmounts(1000n, DEFAULT_GAS_RESERVE);
		expect(quick).toEqual([]);
	});
});
