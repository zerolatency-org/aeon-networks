// apps/web/test/balance.test.ts
import { describe, expect, test } from "bun:test";

import { balanceView, menuRows } from "@/lib/balance";

const base = { wrongNetwork: false, isPending: false, isError: false };

describe("balanceView", () => {
	test("shows the amount with the 0G unit", () => {
		expect(balanceView({ ...base, value: 1_420_000_000_000_000_000n })).toEqual(
			{
				kind: "ok",
				text: "1.42 0G",
			},
		);
	});

	test("a zero balance is shown as 0, not hidden", () => {
		expect(balanceView({ ...base, value: 0n })).toEqual({
			kind: "ok",
			text: "0 0G",
		});
	});

	test("is loading until a value arrives", () => {
		expect(balanceView({ ...base, isPending: true, value: undefined })).toEqual(
			{ kind: "loading" },
		);
		expect(balanceView({ ...base, value: undefined })).toEqual({
			kind: "loading",
		});
	});

	test("says so when the balance cannot be read", () => {
		expect(balanceView({ ...base, isError: true, value: undefined })).toEqual({
			kind: "error",
			text: "Balance unavailable",
		});
	});

	test("a wrong network wins over everything else", () => {
		expect(
			balanceView({
				wrongNetwork: true,
				isPending: true,
				isError: true,
				value: 5n,
			}),
		).toEqual({
			kind: "wrong-network",
			text: "Wrong network",
		});
	});
});

describe("menuRows", () => {
	test("the wallet row is live; credits and agent wallets are marked as coming soon", () => {
		const rows = menuRows({ balanceText: "1.42 0G" });
		expect(rows.map((r) => r.id)).toEqual([
			"wallet",
			"credits",
			"agent-wallets",
		]);
		expect(rows[0]).toEqual({
			id: "wallet",
			label: "Wallet",
			value: "1.42 0G",
			live: true,
		});
		for (const r of rows.slice(1)) {
			expect(r.live).toBe(false);
			expect(r.value).toBe("Coming soon");
		}
	});
});
