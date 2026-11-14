import { gzipSync } from "node:zlib";
export const LIMITS = { baseKb: 170, threeKb: 350 } as const;
export const isThreeChunk = (source: string | Uint8Array) =>
	source.toString().includes("WebGLRenderer");
export const gzipBytes = (data: string | Uint8Array) => gzipSync(data).length;
export const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;
export type Sizes = { baseBytes: number; threeBytes: number | null };
export function budgetProblems(s: Sizes, limits = LIMITS) {
	const out: string[] = [];
	if (kb(s.baseBytes) > limits.baseKb)
		out.push(
			`landing JS is ${kb(s.baseBytes)} KB gzip, over the ${limits.baseKb} KB budget`,
		);
	if (s.threeBytes !== null && kb(s.threeBytes) > limits.threeKb)
		out.push(
			`3D chunk is ${kb(s.threeBytes)} KB gzip, over the ${limits.threeKb} KB budget`,
		);
	return out;
}
