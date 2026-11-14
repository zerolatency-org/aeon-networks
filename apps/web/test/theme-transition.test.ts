// apps/web/test/theme-transition.test.ts
import { describe, expect, test } from "bun:test";

import {
	revealSize,
	WHALE_DURATION_MS,
	WHALE_PSEUDO,
	type WhaleAnimationOptions,
	type WhaleRevealInput,
	whaleReveal,
} from "@/lib/theme-transition";

const viewport = { width: 1440, height: 900 };

function setup(over: Partial<WhaleRevealInput> = {}) {
	const calls = {
		applied: 0,
		started: 0,
		animated: [] as {
			keyframes: Record<string, string[]>;
			options: WhaleAnimationOptions;
		}[],
	};
	const input: WhaleRevealInput = {
		viewport,
		reducedMotion: false,
		startViewTransition: (update) => {
			calls.started += 1;
			update();
			return { ready: Promise.resolve() };
		},
		animate: (keyframes, options) => {
			calls.animated.push({ keyframes, options });
		},
		apply: () => {
			calls.applied += 1;
		},
		...over,
	};
	return { input, calls };
}

describe("whaleReveal", () => {
	test("reduced motion flips the theme at once, with no transition", async () => {
		const { input, calls } = setup({ reducedMotion: true });
		expect(await whaleReveal(input)).toBe("instant");
		expect(calls.applied).toBe(1);
		expect(calls.started).toBe(0);
		expect(calls.animated).toHaveLength(0);
	});

	test("a browser without view transitions flips the theme at once", async () => {
		const { input, calls } = setup({ startViewTransition: undefined });
		expect(await whaleReveal(input)).toBe("instant");
		expect(calls.applied).toBe(1);
		expect(calls.animated).toHaveLength(0);
	});

	test("flips the theme inside the transition, then grows the whale from the centre", async () => {
		const { input, calls } = setup();
		expect(await whaleReveal(input)).toBe("whale");
		expect(calls.started).toBe(1);
		expect(calls.applied).toBe(1);
		expect(calls.animated).toHaveLength(1);

		const { keyframes, options } = calls
			.animated[0] as (typeof calls.animated)[number];
		const end = revealSize(viewport);
		expect(keyframes.maskSize).toEqual(["0px", `${end}px`]);
		// Starts at the centre of the screen and ends with the whale centred on it.
		expect(keyframes.maskPosition).toEqual([
			"720px 450px",
			`${720 - end / 2}px ${450 - end / 2}px`,
		]);
		expect(options.pseudoElement).toBe(WHALE_PSEUDO);
		expect(options.duration).toBe(WHALE_DURATION_MS);
		expect(options.fill).toBe("forwards");
	});

	test("slow motion stretches the duration for tuning", async () => {
		const { input, calls } = setup({ slow: 3 });
		await whaleReveal(input);
		expect(
			(calls.animated[0] as (typeof calls.animated)[number]).options.duration,
		).toBe(WHALE_DURATION_MS * 3);
	});

	test("a skipped transition keeps the new theme and does not animate", async () => {
		const { input, calls } = setup({
			startViewTransition: (update) => {
				update();
				return { ready: Promise.reject(new Error("skipped")) };
			},
		});
		expect(await whaleReveal(input)).toBe("instant");
		expect(calls.applied).toBe(1);
		expect(calls.animated).toHaveLength(0);
	});
});

describe("revealSize", () => {
	test("is six times the screen diagonal, so the whale body covers everything", () => {
		expect(revealSize({ width: 300, height: 400 })).toBe(500 * 6);
	});
});
