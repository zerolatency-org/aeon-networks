// apps/web/test/siwe-api.test.ts
import { describe, expect, test } from "bun:test";

import { ApiError, fetchNonce, linkWallet, verifySiwe } from "@/lib/siwe-api";

type Call = { url: string; init: RequestInit | undefined };
function fakeFetch(response: () => Response) {
	const calls: Call[] = [];
	const impl = async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return response();
	};
	return { impl, calls };
}
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

describe("siwe api", () => {
	test("fetchNonce posts an empty object with cookies and returns the nonce", async () => {
		const f = fakeFetch(() => json({ nonce: "abc123XYZ" }));
		expect(await fetchNonce(f.impl)).toBe("abc123XYZ");
		const call = f.calls[0] as Call;
		expect(call.url).toBe("/api/auth/siwe/nonce");
		expect(call.init?.method).toBe("POST");
		expect(call.init?.credentials).toBe("include");
		expect(call.init?.body).toBe("{}");
	});

	test("verifySiwe sends the message and signature and returns the user id", async () => {
		const f = fakeFetch(() => json({ token: "t", user: { id: "u1" } }));
		const out = await verifySiwe({ message: "m", signature: "0xabc" }, f.impl);
		expect(out).toEqual({ userId: "u1" });
		const call = f.calls[0] as Call;
		expect(call.url).toBe("/api/auth/siwe/verify");
		expect(JSON.parse(call.init?.body as string)).toEqual({
			message: "m",
			signature: "0xabc",
		});
	});

	test("linkWallet returns the result, and failures become an ApiError with the server's code", async () => {
		const ok = fakeFetch(() =>
			json({ address: "0xabc", chainId: 16602, alreadyLinked: false }),
		);
		expect(
			await linkWallet({ message: "m", signature: "0x01" }, ok.impl),
		).toEqual({
			address: "0xabc",
			chainId: 16602,
			alreadyLinked: false,
		});
		expect((ok.calls[0] as Call).url).toBe("/api/wallet/link");

		const taken = fakeFetch(() =>
			json({ code: "WALLET_TAKEN", status: 409 }, 409),
		);
		const err = await linkWallet(
			{ message: "m", signature: "0x01" },
			taken.impl,
		).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.code).toBe("WALLET_TAKEN");
		expect(err.status).toBe(409);

		const down = fakeFetch(() => new Response("oops", { status: 500 }));
		const err2 = await linkWallet(
			{ message: "m", signature: "0x01" },
			down.impl,
		).catch((e) => e);
		expect(err2.code).toBe("HTTP_500");
	});
});
