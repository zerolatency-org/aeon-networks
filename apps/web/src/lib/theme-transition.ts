// apps/web/src/lib/theme-transition.ts
// The whale reveal: the browser snapshots the old page, we switch the theme
// inside the callback, then the new page is drawn through a whale-shaped mask
// that grows from the centre of the screen until it covers everything.
// Everything the browser provides is passed in, so the logic runs in tests.

export type ThemeName = "dark" | "light";

export type WhaleAnimationOptions = {
	duration: number;
	easing: string;
	fill: "forwards";
	pseudoElement: string;
};

export type WhaleRevealInput = {
	viewport: { width: number; height: number };
	reducedMotion: boolean;
	/** 1 = normal speed. /lab offers 3 and 6 for tuning the whale's path. */
	slow?: number;
	startViewTransition?:
		| ((update: () => void) => { ready: Promise<unknown> })
		| undefined;
	animate: (
		keyframes: Record<string, string[]>,
		options: WhaleAnimationOptions,
	) => unknown;
	/** Flips the theme. Must change the DOM synchronously. */
	apply: () => void;
};

export const WHALE_DURATION_MS = 1100;
export const WHALE_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
export const WHALE_PSEUDO = "::view-transition-new(root)";

/** Mask width at the end: the whale body alone must cover the viewport. */
export function revealSize(viewport: {
	width: number;
	height: number;
}): number {
	return Math.hypot(viewport.width, viewport.height) * 6;
}

export async function whaleReveal(
	input: WhaleRevealInput,
): Promise<"instant" | "whale"> {
	if (input.reducedMotion || !input.startViewTransition) {
		input.apply();
		return "instant";
	}

	const end = revealSize(input.viewport);
	const cx = input.viewport.width / 2;
	const cy = input.viewport.height / 2;
	const transition = input.startViewTransition(input.apply);

	try {
		await transition.ready;
	} catch {
		// The browser skipped the transition. The theme has already changed.
		return "instant";
	}

	input.animate(
		{
			maskSize: ["0px", `${end}px`],
			// The mask image is square, so centring it takes half its size on each axis.
			maskPosition: [`${cx}px ${cy}px`, `${cx - end / 2}px ${cy - end / 2}px`],
			transform: ["rotate(-6deg)", "rotate(0deg)"],
		},
		{
			duration: WHALE_DURATION_MS * (input.slow ?? 1),
			easing: WHALE_EASING,
			fill: "forwards",
			pseudoElement: WHALE_PSEUDO,
		},
	);
	return "whale";
}
