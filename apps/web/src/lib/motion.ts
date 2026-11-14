// apps/web/src/lib/motion.ts
// The same numbers as the --dur-* and --ease-* variables in globals.css
// (a test keeps them equal). Durations are in seconds, as motion/react expects.

export const DURATION = {
	fast: 0.15,
	base: 0.24,
	slow: 0.4,
	story: 1,
} as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
