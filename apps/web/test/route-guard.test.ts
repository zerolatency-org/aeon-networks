// apps/web/test/route-guard.test.ts
import { describe, expect, test } from "bun:test";

import {
	guardDecision,
	isWalletRequired,
	loginUrl,
	routeAccess,
} from "@/lib/route-guard";

describe("routeAccess", () => {
	test("the landing page, login and the lab are public", () => {
		for (const p of [
			"/",
			"/login",
			"/login/",
			"/lab",
			"/lab/x",
			"/login?next=/agents",
		]) {
			expect(routeAccess(p), p).toBe("public");
		}
	});

	test("settings needs a session only; everything else needs a wallet, even pages that do not exist yet", () => {
		expect(routeAccess("/settings")).toBe("session");
		expect(routeAccess("/settings/accounts")).toBe("session");
		for (const p of [
			"/agents",
			"/agents/12",
			"/jobs",
			"/chats/9?x=1",
			"/something-new",
		]) {
			expect(routeAccess(p), p).toBe("wallet");
		}
	});

	test("a path that merely starts with a public name is not public", () => {
		for (const p of ["/labs", "/loginx", "/settings-old"]) {
			expect(routeAccess(p), p).toBe("wallet");
		}
	});
});

describe("guardDecision", () => {
	const next = "/agents/12?tab=jobs";

	test("public pages are always allowed, even while the session loads or fails", () => {
		for (const session of [
			"loading",
			"error",
			"signed-out",
			"needs-wallet",
			"ready",
		] as const) {
			expect(
				guardDecision({ access: "public", session, next }),
				session,
			).toEqual({ action: "allow" });
		}
	});

	test("a protected page waits while loading and reports a server problem", () => {
		expect(
			guardDecision({ access: "wallet", session: "loading", next }),
		).toEqual({ action: "wait" });
		expect(guardDecision({ access: "wallet", session: "error", next })).toEqual(
			{
				action: "unavailable",
			},
		);
	});

	test("a signed-out visitor is sent to login with a way back", () => {
		expect(
			guardDecision({ access: "wallet", session: "signed-out", next }),
		).toEqual({
			action: "redirect",
			to: "/login?next=%2Fagents%2F12%3Ftab%3Djobs",
		});
		expect(loginUrl("/settings")).toBe("/login?next=%2Fsettings");
	});

	test("a user without a wallet may use session pages but is sent to link for wallet pages", () => {
		expect(
			guardDecision({
				access: "session",
				session: "needs-wallet",
				next: "/settings",
			}),
		).toEqual({
			action: "allow",
		});
		expect(
			guardDecision({ access: "wallet", session: "needs-wallet", next }),
		).toEqual({
			action: "redirect",
			to: loginUrl(next),
		});
		expect(guardDecision({ access: "wallet", session: "ready", next })).toEqual(
			{ action: "allow" },
		);
	});
});

describe("isWalletRequired", () => {
	test("only the WALLET_REQUIRED code counts, not any other 403 or 401", () => {
		expect(isWalletRequired({ code: "WALLET_REQUIRED", status: 403 })).toBe(
			true,
		);
		expect(isWalletRequired({ code: "FORBIDDEN", status: 403 })).toBe(false);
		expect(isWalletRequired({ code: "UNAUTHORIZED", status: 401 })).toBe(false);
		expect(isWalletRequired(new Error("x"))).toBe(false);
	});
});
