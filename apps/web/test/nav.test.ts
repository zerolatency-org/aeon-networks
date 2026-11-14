// apps/web/test/nav.test.ts
import { describe, expect, test } from "bun:test";

import {
	commandItems,
	isActive,
	isCommandShortcut,
	showNavbar,
} from "@/lib/nav";

const ids = (status: Parameters<typeof commandItems>[0]) =>
	commandItems(status).map((i) => i.id);

describe("navbar rules", () => {
	test("a link is active on its page and below it, but not on a lookalike", () => {
		expect(isActive("/agents", "/agents")).toBe(true);
		expect(isActive("/agents/12?tab=jobs", "/agents")).toBe(true);
		expect(isActive("/agents-archive", "/agents")).toBe(false);
		expect(isActive("/settings", "/agents")).toBe(false);
	});

	test("login and the lab draw their own header, every other page gets the navbar", () => {
		expect(showNavbar("/login")).toBe(false);
		expect(showNavbar("/lab")).toBe(false);
		expect(showNavbar("/")).toBe(true);
		expect(showNavbar("/agents")).toBe(true);
		expect(showNavbar("/labs")).toBe(true);
	});

	test("Command+K and Control+K open the palette, plain K does not", () => {
		expect(isCommandShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(
			true,
		);
		expect(isCommandShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(
			true,
		);
		expect(
			isCommandShortcut({ key: "k", metaKey: false, ctrlKey: false }),
		).toBe(false);
		expect(isCommandShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(
			false,
		);
	});
});

describe("commandItems", () => {
	test("a signed-out visitor can go home, sign in and switch theme", () => {
		expect(ids("signed-out")).toEqual(["home", "sign-in", "theme"]);
	});

	test("a user without a wallet can open settings and link a wallet, but not the wallet pages", () => {
		expect(ids("needs-wallet")).toEqual([
			"home",
			"settings",
			"link-wallet",
			"sign-out",
			"theme",
		]);
	});

	test("a ready user gets every page and can sign out; ids never repeat", () => {
		expect(ids("ready")).toEqual([
			"home",
			"agents",
			"settings",
			"sign-out",
			"theme",
		]);
		for (const s of ["signed-out", "needs-wallet", "ready"] as const) {
			expect(new Set(ids(s)).size).toBe(ids(s).length);
		}
	});
});
