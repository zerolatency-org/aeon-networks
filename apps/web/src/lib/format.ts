export function formatOg(wei: bigint): string {
	const whole = wei / 10n ** 18n;
	const fraction = (wei % 10n ** 18n)
		.toString()
		.padStart(18, "0")
		.replace(/0+$/, "")
		.slice(0, 4);
	return fraction ? `${whole}.${fraction}` : whole.toString();
}
