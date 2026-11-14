// apps/web/test/session.test.ts
import { describe, expect, test } from "bun:test";

import { shouldRetry } from "@/lib/retry";
import { deriveSession, displayName, type Me } from "@/lib/session";

const user = { id: "u1", name: "Ada", email: "ada@example.com", image: null };
const A = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2aB" as `0x${string}`;
const B = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const me = (wallets: Me["wallets"]): Me => ({ user, wallets });

describe("deriveSession", () => {
	test("is loading while the first answer is pending", () => {
		expect(
			deriveSession({ data: undefined, error: null, isPending: true }),
		).toEqual({
			status: "loading",
		});
	});

	test("a 401 means signed out, but any other error is an error, not signed out", () => {
		const gone = { data: undefined, isPending: false };
		expect(
			deriveSession({ ...gone, error: { code: "UNAUTHORIZED", status: 401 } })
				.status,
		).toBe("signed-out");
		expect(deriveSession({ ...gone, error: { status: 401 } }).status).toBe(
			"signed-out",
		);
		expect(
			deriveSession({ ...gone, error: new Error("network down") }).status,
		).toBe("error");
		expect(
			deriveSession({
				...gone,
				error: { code: "INTERNAL_SERVER_ERROR", status: 500 },
			}).status,
		).toBe("error");
	});

	test("a user with no wallet needs to link one", () => {
		expect(
			deriveSession({ data: me([]), error: null, isPending: false }),
		).toEqual({
			status: "needs-wallet",
			user,
		});
	});

	test("a user with a wallet is ready, using the primary wallet", () => {
		const s = deriveSession({
			data: me([
				{ address: B, chainId: 16602, isPrimary: false },
				{ address: A, chainId: 16602, isPrimary: true },
			]),
			error: null,
			isPending: false,
		});
		expect(s.status).toBe("ready");
		if (s.status === "ready") {
			expect(s.wallet.address).toBe(A.toLowerCase() as `0x${string}`);
			expect(s.wallets).toHaveLength(2);
		}
	});
});

describe("displayName", () => {
	test("prefers the name, then the short wallet address, then the email", () => {
		const w = { address: A.toLowerCase() as `0x${string}`, chainId: 16602 };
		expect(displayName(user, w)).toBe("Ada");
		// the API returns lower-case addresses
		expect(displayName({ ...user, name: " " }, w)).toBe("0x3eb…a2ab");
		expect(displayName({ ...user, name: null }, undefined)).toBe(
			"ada@example.com",
		);
		expect(displayName({ ...user, name: null, email: null }, undefined)).toBe(
			"Account",
		);
	});
});

describe("shouldRetry", () => {
	test("never retries answers that will not change, retries other failures twice", () => {
		expect(shouldRetry(0, { code: "UNAUTHORIZED", status: 401 })).toBe(false);
		expect(shouldRetry(0, { code: "WALLET_REQUIRED", status: 403 })).toBe(
			false,
		);
		expect(shouldRetry(0, new Error("network"))).toBe(true);
		expect(shouldRetry(1, new Error("network"))).toBe(true);
		expect(shouldRetry(2, new Error("network"))).toBe(false);
	});
});
