// apps/web/src/lib/sweep-form.ts
import { formatOg } from "./format";
import { parseOg } from "./policy-form";

/** 0.005 0G gas reserve kept in agent wallet for transaction execution. */
export const DEFAULT_GAS_RESERVE = 5n * 10n ** 15n;

export function maxSweepable(
	balanceWei: bigint,
	gasReserveWei: bigint = DEFAULT_GAS_RESERVE,
): bigint {
	if (balanceWei <= gasReserveWei) return 0n;
	return balanceWei - gasReserveWei;
}

export function checkSweepAmount(
	text: string,
	balanceWei: bigint,
	gasReserveWei: bigint = DEFAULT_GAS_RESERVE,
): { ok: boolean; wei?: bigint; message?: string } {
	const trimmed = text.trim();
	if (!trimmed) {
		return { ok: false, message: "Enter an amount in 0G to withdraw." };
	}

	const wei = parseOg(trimmed);
	if (wei === null || wei <= 0n) {
		return { ok: false, message: "Enter a valid positive 0G amount." };
	}

	const max = maxSweepable(balanceWei, gasReserveWei);
	if (max === 0n) {
		return {
			ok: false,
			message: `No sweepable funds. A gas reserve of ${formatOg(gasReserveWei)} 0G must remain in the agent wallet.`,
		};
	}

	if (wei > max) {
		return {
			ok: false,
			message: `Cannot sweep more than ${formatOg(max)} 0G (keeping ${formatOg(gasReserveWei)} 0G gas reserve).`,
		};
	}

	return { ok: true, wei };
}

export function quickSweepAmounts(
	balanceWei: bigint,
	gasReserveWei: bigint = DEFAULT_GAS_RESERVE,
): { percent: number; label: string; wei: bigint }[] {
	const max = maxSweepable(balanceWei, gasReserveWei);
	if (max === 0n) return [];

	return [
		{
			percent: 25,
			label: "25%",
			wei: (max * 25n) / 100n,
		},
		{
			percent: 50,
			label: "50%",
			wei: (max * 50n) / 100n,
		},
		{
			percent: 100,
			label: "Max (100%)",
			wei: max,
		},
	];
}
