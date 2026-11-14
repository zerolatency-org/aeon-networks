// apps/web/src/components/theme/use-theme-toggle.ts
"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";

import { type ThemeName, whaleReveal } from "@/lib/theme-transition";

/** Flips light and dark with the whale reveal. `slow` stretches the animation for tuning. */
export function useThemeToggle(slow = 1): () => void {
	const { resolvedTheme, setTheme } = useTheme();

	return useCallback(() => {
		const next: ThemeName = resolvedTheme === "dark" ? "light" : "dark";
		const root = document.documentElement;
		void whaleReveal({
			viewport: { width: window.innerWidth, height: window.innerHeight },
			reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
				.matches,
			slow,
			startViewTransition: document.startViewTransition?.bind(document),
			animate: (keyframes, options) => root.animate(keyframes, options),
			apply: () => {
				root.classList.toggle("dark", next === "dark");
				root.classList.toggle("light", next === "light");
				root.style.colorScheme = next;
				setTheme(next);
			},
		});
	}, [resolvedTheme, setTheme, slow]);
}
