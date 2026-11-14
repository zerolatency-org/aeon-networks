// apps/web/test/fund.test.ts
import { describe, expect, test } from "bun:test";

import type { Hex } from "@/lib/agents-parse";
import {
	balanceStatus,
	balanceText,
	checkFund,
	FUND_PRESETS,
	fundTx,
	GAS_RESERVE,
	pollBalance,
} from "@/lib/fund";

const WALLET = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab" as Hex;
const og = (n: string) => BigInt(Math.round(Number(n) * 1e6)) * 10n ** 12n;

describe("checking the amount", () => {
	test("every quick amount is valid, and typed amounts become wei", () => {
		for (const p of FUND_PRESETS) expect(checkFund(p, null).ok, p).toBe(true);
		expect(checkFund("0.05", null)).toEqual({ ok: true, wei: og("0.05") });
	});

	test("empty, unreadable and zero amounts say what to fix", () => {
		expect(checkFund("", null)).toMatchObject({
			ok: false,
			message: "Enter an amount in 0G.",
		});
		expect(checkFund("lots", null).ok).toBe(false);
		expect(checkFund("0", null)).toMatchObject({
			ok: false,
			message: "Enter more than zero.",
		});
	});

	test("the owner must keep enough for gas, and an unknown balance does not block", () => {
		const balance = og("0.1");
		expect(checkFund("0.05", balance).ok).toBe(true);
		expect(checkFund("0.1", balance)).toMatchObject({ ok: false });
		expect(checkFund("0.099", balance).ok).toBe(true);
		const tight = checkFund("0.0995", balance);
		expect(tight.ok).toBe(false);
		expect(checkFund("5", null).ok).toBe(true);
		expect(GAS_RESERVE).toBe(10n ** 15n);
		const none = checkFund("0.01", 0n);
		expect(none).toMatchObject({
			ok: false,
			message: "Your wallet has 0 0G to send after gas.",
		});
	});
});

describe("the transaction and the balance", () => {
	test("funding is a plain transfer with no data", () => {
		expect(fundTx(WALLET, og("0.05"), 16602)).toEqual({
			chainId: 16602,
			to: WALLET,
			value: "50000000000000000",
			data: "0x",
		});
	});

	test("the balance is empty, low, ready or unknown", () => {
		expect(balanceStatus(null)).toBe("unknown");
		expect(balanceStatus("0")).toBe("empty");
		expect(balanceStatus("9999999999999999")).toBe("low");
		expect(balanceStatus("10000000000000000")).toBe("ready");
		expect(balanceText("50000000000000000")).toBe("0.05");
		expect(balanceText(null)).toBe("--");
	});
});

describe("watching for the funds to arrive", () => {
	test("stops as soon as the balance goes above what it was", async () => {
		const reads = ["0", "0", "50000000000000000"];
		let i = 0;
		let sleeps = 0;
		const result = await pollBalance({
			read: async () => reads[i++] ?? "0",
			before: "0",
			sleep: async () => void sleeps++,
		});
		expect(result).toBe("50000000000000000");
		expect(sleeps).toBe(2);
	});

	test("gives up after its attempts with the last balance, and failed reads do not throw", async () => {
		let sleeps = 0;
		const flat = await pollBalance({
			read: async () => "7",
			before: "7",
			attempts: 3,
			sleep: async () => void sleeps++,
		});
		expect(flat).toBe("7");
		expect(sleeps).toBe(2);
		const broken = await pollBalance({
			read: async () => {
				throw new Error("down");
			},
			before: null,
			attempts: 2,
			sleep: async () => {},
		});
		expect(broken).toBeNull();
	});
});
