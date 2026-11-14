// apps/web/src/components/ui/card.tsx
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"border-border bg-surface-1 rounded-lg border p-5",
				className,
			)}
			{...props}
		/>
	);
}

export function CardTitle({
	className,
	children,
	...props
}: ComponentProps<"h3">) {
	return (
		<h3
			className={cn(
				"font-serif text-[28px] leading-[34px] tracking-tight",
				className,
			)}
			{...props}
		>
			{children}
		</h3>
	);
}
