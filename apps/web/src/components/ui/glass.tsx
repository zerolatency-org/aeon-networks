// apps/web/src/components/ui/glass.tsx
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** For layers that float over content only. Keep at most three on screen. */
export function Glass({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("glass rounded-xl", className)} {...props} />;
}
