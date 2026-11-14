// apps/web/src/lib/contrast.ts
// WCAG 2.x contrast math. Used by the token tests and by the /lab swatches.

export function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(h)) {
		throw new Error(`Not a 6-digit hex color: ${hex}`);
	}
	return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [
		number,
		number,
		number,
	];
}

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
	const x = luminance(a);
	const y = luminance(b);
	const [hi, lo] = x >= y ? [x, y] : [y, x];
	return (hi + 0.05) / (lo + 0.05);
}
