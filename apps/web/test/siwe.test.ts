// apps/web/test/siwe.test.ts
import { describe, expect, test } from "bun:test";
import { parseSiweMessage } from "viem/siwe";

import { buildSiweMessage } from "@/lib/siwe";

const address = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab" as const;
const base = {
	address,
	nonce: "abc12345XYZ",
	chainId: 16602,
	domain: "localhost:3001",
	origin: "http://localhost:3001",
	now: new Date("2026-11-01T10:00:00.000Z"),
};

describe("buildSiweMessage", () => {
	test("carries the domain, chain, nonce and address the backend checks", () => {
		const parsed = parseSiweMessage(
			buildSiweMessage({ ...base, purpose: "sign-in" }),
		);
		expect(parsed.domain).toBe("localhost:3001");
		expect(parsed.chainId).toBe(16602);
		expect(parsed.nonce).toBe("abc12345XYZ");
		expect(parsed.address?.toLowerCase()).toBe(address);
		expect(parsed.uri).toBe("http://localhost:3001");
		expect(parsed.version).toBe("1");
	});

	test("expires ten minutes after it was issued", () => {
		const parsed = parseSiweMessage(
			buildSiweMessage({ ...base, purpose: "sign-in" }),
		);
		expect(parsed.issuedAt?.toISOString()).toBe("2026-11-01T10:00:00.000Z");
		expect(parsed.expirationTime?.toISOString()).toBe(
			"2026-11-01T10:10:00.000Z",
		);
	});

	test("says what the signature is for, in words a person can read", () => {
		const signIn = parseSiweMessage(
			buildSiweMessage({ ...base, purpose: "sign-in" }),
		);
		const link = parseSiweMessage(
			buildSiweMessage({ ...base, purpose: "link" }),
		);
		expect(signIn.statement).toBe("Sign in to Aeon");
		expect(link.statement).toMatch(/link this wallet/i);
		expect(link.statement).not.toBe(signIn.statement);
	});
});
