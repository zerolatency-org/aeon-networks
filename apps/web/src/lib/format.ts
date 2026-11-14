// apps/web/src/lib/format.ts
// How the app shows 0G amounts and addresses. Amounts are bigint wei (18 decimals).

const UNIT = 10n ** 18n;

/** 1420000000000000000n -> "1.42". Cuts extra digits, never rounds up. */
export function formatOg(wei: bigint, maxDecimals = 4): string {
	if (wei < 0n) return `-${formatOg(-wei, maxDecimals)}`;
	const whole = wei / UNIT;
	const frac = wei % UNIT;
	const kept = frac / 10n ** BigInt(18 - maxDecimals);
	if (whole === 0n && kept === 0n && frac > 0n) {
		return `<0.${"0".repeat(maxDecimals - 1)}1`;
	}
	const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	if (kept === 0n) return wholeText;
	const fracText = kept
		.toString()
		.padStart(maxDecimals, "0")
		.replace(/0+$/, "");
	return `${wholeText}.${fracText}`;
}

/** 0x3eb2...a2aB -> 0x3eb…a2aB. Anything that is not an address comes back unchanged. */
export function shortAddress(value: string): string {
	if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return value;
	return `${value.slice(0, 5)}…${value.slice(-4)}`;
}
