// apps/web/test/login-problems.test.ts
import { describe, expect, test } from "bun:test";

import { PROBLEM_COPY, PROBLEMS, problemFrom } from "@/lib/login-problems";
import { ApiError } from "@/lib/siwe-api";

describe("login problems", () => {
	test("every problem has plain copy with no server codes in it", () => {
		for (const p of PROBLEMS) {
			const { title, hint } = PROBLEM_COPY[p];
			expect(title.length, p).toBeGreaterThan(3);
			expect(hint.length, p).toBeGreaterThan(10);
			expect(`${title} ${hint}`, p).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
		}
	});

	test("maps every code the wallet link route can return", () => {
		const table: [string, number, string][] = [
			["WALLET_TAKEN", 409, "wallet-taken"],
			["SIWE_WRONG_CHAIN", 401, "wrong-network"],
			["SIWE_EXPIRED", 401, "expired"],
			["SIWE_NONCE_INVALID", 401, "expired"],
			["SIWE_SIGNATURE_INVALID", 401, "bad-signature"],
			["SIWE_WRONG_DOMAIN", 401, "wrong-site"],
			["SIWE_MESSAGE_INVALID", 400, "wrong-site"],
			["UNAUTHORIZED", 401, "session-needed"],
		];
		for (const [code, status, expected] of table) {
			expect(problemFrom(new ApiError(code, status)), code).toBe(
				expected as never,
			);
		}
		expect(problemFrom(new ApiError("HTTP_401", 401))).toBe("bad-signature");
		expect(problemFrom(new ApiError("HTTP_500", 500))).toBe("unknown");
	});

	test("recognises a wallet user rejection in its different shapes", () => {
		expect(problemFrom({ code: 4001, message: "x" })).toBe(
			"signature-rejected",
		);
		expect(
			problemFrom({ name: "UserRejectedRequestError", message: "x" }),
		).toBe("signature-rejected");
		expect(problemFrom(new Error("User rejected the request."))).toBe(
			"signature-rejected",
		);
		expect(problemFrom({ cause: { code: 4001 }, message: "wrapped" })).toBe(
			"signature-rejected",
		);
	});

	test("recognises a wrong network and a blocked pop-up, and falls back to unknown", () => {
		expect(problemFrom({ name: "ChainMismatchError", message: "x" })).toBe(
			"wrong-network",
		);
		expect(problemFrom(new Error("Please switch the chain to continue"))).toBe(
			"wrong-network",
		);
		expect(problemFrom(new Error("Popup was blocked by the browser"))).toBe(
			"popup-blocked",
		);
		expect(problemFrom(new Error("boom"))).toBe("unknown");
		expect(problemFrom(undefined)).toBe("unknown");
	});
});
