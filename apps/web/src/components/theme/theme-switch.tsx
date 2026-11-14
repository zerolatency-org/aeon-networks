// apps/web/src/components/theme/theme-switch.tsx
"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { type ThemeName, whaleReveal } from "@/lib/theme-transition";
import { cn } from "@/lib/utils";

export function ThemeSwitch({
	slow = 1,
	className,
}: {
	slow?: number;
	className?: string;
}) {
	const { resolvedTheme, setTheme } = useTheme();

	function toggle() {
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
	}

	return (
		<button
			type="button"
			aria-label="Switch theme"
			onClick={toggle}
			className={cn(
				"text-fg-2 hover:bg-surface-2 hover:text-fg grid size-9 place-items-center rounded-md transition-colors duration-(--dur-fast)",
				className,
			)}
		>
			<Sun
				aria-hidden
				weight="regular"
				size={18}
				className="hidden dark:block"
			/>
			<Moon aria-hidden weight="regular" size={18} className="dark:hidden" />
		</button>
	);
}
