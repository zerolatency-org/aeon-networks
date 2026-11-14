// apps/web/src/lib/fund.ts
// The fund step: the owner sends some 0G from their own wallet to the agent's wallet, so the
// agent can pay gas and hire. Pure: amounts, checks, the transaction, and a balance poll.
import type { Hex, TxRequest } from "./agents-parse";
import { formatOg } from "./format";
import { ogText, parseOg } from "./policy-form";

/** Quick amounts in 0G. */
export const FUND_PRESETS = ["0.01", "0.05", "0.1"] as const;

/** Kept back in the owner's wallet for the gas of the funding transaction. */
export const GAS_RESERVE = 10n ** 15n; // 0.001 0G

/** An agent with at least this much (0.01 0G) can pay gas for a few jobs. */
export const READY_BALANCE = 10n ** 16n;

export type FundCheck =
	| { ok: true; wei: bigint }
	| { ok: false; message: string };

/** Checks what the owner typed. `ownerBalance` is null while it is still loading. */
export function checkFund(
	text: string,
	ownerBalance: bigint | null,
): FundCheck {
	if (text.trim() === "")
		return { ok: false, message: "Enter an amount in 0G." };
	const wei = parseOg(text);
	if (wei === null)
		return { ok: false, message: "Enter an amount in 0G, like 0.05." };
	if (wei === 0n) return { ok: false, message: "Enter more than zero." };
	if (ownerBalance !== null && wei + GAS_RESERVE > ownerBalance) {
		const room = ownerBalance > GAS_RESERVE ? ownerBalance - GAS_RESERVE : 0n;
		return {
			ok: false,
			message: `Your wallet has ${formatOg(room)} 0G to send after gas.`,
		};
	}
	return { ok: true, wei };
}

/** A plain transfer from the owner to the agent wallet. */
export function fundTx(
	agentWallet: Hex,
	wei: bigint,
	chainId: number,
): TxRequest {
	return { chainId, to: agentWallet, value: wei.toString(), data: "0x" };
}

export type BalanceStatus = "unknown" | "empty" | "low" | "ready";

export function balanceStatus(balanceWei: string | null): BalanceStatus {
	if (balanceWei === null) return "unknown";
	const wei = BigInt(balanceWei);
	if (wei === 0n) return "empty";
	return wei < READY_BALANCE ? "low" : "ready";
}

export const STATUS_WORDS: Record<BalanceStatus, string> = {
	unknown: "Balance unavailable right now.",
	empty: "Empty. The agent cannot sign jobs until it has some 0G.",
	low: "Low. Add more so it can pay gas for jobs.",
	ready: "Funded. The agent can pay gas for jobs.",
};

/** The amount text for a balance, for display: "0.05". */
export const balanceText = (balanceWei: string | null) =>
	balanceWei === null ? "--" : ogText(BigInt(balanceWei));

/**
 * Reads the agent's balance until it goes above `before` or the attempts run out.
 * Returns the last balance read (null if every read failed).
 */
export async function pollBalance(opts: {
	read: () => Promise<string | null>;
	before: string | null;
	attempts?: number;
	intervalMs?: number;
	sleep: (ms: number) => Promise<void>;
}): Promise<string | null> {
	const { read, before, attempts = 10, intervalMs = 3000, sleep } = opts;
	const start = before === null ? 0n : BigInt(before);
	let last: string | null = null;
	for (let i = 0; i < attempts; i++) {
		last = await read().catch(() => null);
		if (last !== null && BigInt(last) > start) return last;
		if (i < attempts - 1) await sleep(intervalMs);
	}
	return last;
}
