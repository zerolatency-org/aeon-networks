// apps/web/src/components/theme/theme-switch.tsx
"use client";

import { Moon, Sun } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useThemeToggle } from "./use-theme-toggle";

export function ThemeSwitch({
	slow = 1,
	className,
}: {
	slow?: number;
	className?: string;
}) {
	const toggle = useThemeToggle(slow);

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
