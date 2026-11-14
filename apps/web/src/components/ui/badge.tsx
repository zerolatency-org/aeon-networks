// apps/web/src/components/ui/badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-medium tracking-[0.06em] uppercase",
	{
		variants: {
			tone: {
				neutral: "bg-surface-2 text-fg-2",
				storage: "bg-tide/8 text-tide",
				agent: "bg-iris/8 text-iris",
				waiting: "bg-ember/8 text-ember",
				danger: "bg-coral/8 text-coral",
				done: "bg-moss/8 text-moss",
				live: "bg-lumen text-lumen-ink",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);

export function Badge({
	className,
	tone,
	...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
