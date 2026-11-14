// apps/web/src/components/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-(--dur-fast) ease-out disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				lumen: "bg-lumen text-lumen-ink hover:bg-lumen/85",
				default: "bg-surface-2 text-fg hover:bg-surface-3",
				outline: "border-border-strong text-fg hover:bg-surface-2 border",
				ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
				danger: "bg-coral/12 text-coral hover:bg-coral/20",
			},
			size: {
				sm: "h-8 px-3 text-[13px]",
				md: "h-9 px-4 text-[15px]",
				lg: "h-11 px-6 text-[15px]",
			},
		},
		defaultVariants: { variant: "default", size: "md" },
	},
);

export type ButtonProps = ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
	className,
	variant,
	size,
	asChild = false,
	type,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			className={cn(buttonVariants({ variant, size }), className)}
			{...(asChild ? {} : { type: type ?? "button" })}
			{...props}
		/>
	);
}
