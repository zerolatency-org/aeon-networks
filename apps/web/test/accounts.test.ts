// apps/web/test/accounts.test.ts
import { describe, expect, test } from "bun:test";

import { methodCount, providerRows, unlinkMessage } from "@/lib/accounts";

const row = (providerId: string) => ({ providerId });

describe("providerRows", () => {
	test("marks which providers are linked and ignores rows that are not Google or GitHub", () => {
		const rows = providerRows({
			accounts: [row("google"), row("siwe")],
			walletCount: 1,
		});
		expect(rows.map((r) => [r.id, r.linked])).toEqual([
			["google", true],
			["github", false],
		]);
	});

	test("an account that is the only way to sign in cannot be removed", () => {
		const rows = providerRows({ accounts: [row("google")], walletCount: 0 });
		expect(rows[0]).toMatchObject({
			id: "google",
			linked: true,
			canUnlink: false,
		});
		expect(rows[1]).toMatchObject({
			id: "github",
			linked: false,
			canUnlink: false,
		});
	});

	test("with a wallet or a second account, an account can be removed", () => {
		const withWallet = providerRows({
			accounts: [row("google")],
			walletCount: 1,
		});
		expect(withWallet[0]?.canUnlink).toBe(true);
		const both = providerRows({
			accounts: [row("google"), row("github")],
			walletCount: 0,
		});
		expect(both.map((r) => r.canUnlink)).toEqual([true, true]);
	});
});

describe("methodCount", () => {
	test("counts each linked account once and all wallets together as one", () => {
		expect(
			methodCount({
				accounts: [row("google"), row("github"), row("google"), row("siwe")],
				walletCount: 2,
			}),
		).toBe(3);
		expect(methodCount({ accounts: [], walletCount: 0 })).toBe(0);
	});
});

describe("unlinkMessage", () => {
	test("a 400 means the last sign-in method; anything else is a generic failure", () => {
		expect(unlinkMessage({ status: 400 }).title).toMatch(
			/only way to sign in/i,
		);
		expect(unlinkMessage({ status: 500 }).title).toBe("Could not remove it");
		expect(unlinkMessage(new Error("network")).title).toBe(
			"Could not remove it",
		);
	});
});
