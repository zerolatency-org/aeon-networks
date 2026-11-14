// apps/web/test/mint-deps.test.ts
import { describe, expect, test } from "bun:test";

import type { Hex } from "@/lib/agents-parse";
import { makeMintDeps } from "@/lib/mint-deps";

const WALLET = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab" as Hex;
const HASH = `0x${"ab".repeat(32)}` as Hex;

function chain(status: "success" | "reverted" = "success") {
	const sent: unknown[] = [];
	const waited: unknown[] = [];
	return {
		sent,
		waited,
		bits: {
			sendTransaction: async (args: unknown) => (sent.push(args), HASH),
			waitForReceipt: async (hash: Hex) => (waited.push(hash), { status }),
		},
	};
}

describe("the wallet side of the mint", () => {
	test("a transaction request becomes a wallet call with the amount as a bigint", async () => {
		const c = chain();
		const deps = makeMintDeps(c.bits);
		const hash = await deps.sendTx({
			chainId: 16602,
			to: WALLET,
			value: "100000000000000000",
			data: "0xaa",
		});
		expect(hash).toBe(HASH);
		expect(c.sent[0]).toEqual({
			chainId: 16602,
			to: WALLET,
			value: 100000000000000000n,
			data: "0xaa",
		});
		await deps.sendTx({ chainId: 16602, to: WALLET, value: "0", data: "0xbb" });
		expect((c.sent[1] as { value: bigint }).value).toBe(0n);
	});

	test("waiting for a receipt answers success or reverted", async () => {
		const ok = chain("success");
		expect(await makeMintDeps(ok.bits).waitMined(HASH)).toBe("success");
		expect(ok.waited).toEqual([HASH]);
		expect(await makeMintDeps(chain("reverted").bits).waitMined(HASH)).toBe(
			"reverted",
		);
	});

	test("the server calls and the clock are the real ones unless replaced", async () => {
		const seen: string[] = [];
		const deps = makeMintDeps(chain().bits, {
			saveAvatar: async (id) => void seen.push(`avatar:${id}`),
			sleep: async (ms) => void seen.push(`sleep:${ms}`),
		});
		await deps.saveAvatar("a1", { kind: "preset", id: "p01" });
		await deps.sleep(5);
		expect(seen).toEqual(["avatar:a1", "sleep:5"]);
		expect(typeof makeMintDeps(chain().bits).prepare).toBe("function");
		const started = Date.now();
		await makeMintDeps(chain().bits).sleep(20);
		expect(Date.now() - started).toBeGreaterThanOrEqual(15);
	});
});
