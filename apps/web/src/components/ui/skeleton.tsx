// apps/web/src/components/ui/skeleton.tsx
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			aria-hidden="true"
			className={cn("animate-surface-pulse bg-surface-2 rounded-md", className)}
			{...props}
		/>
	);
}
