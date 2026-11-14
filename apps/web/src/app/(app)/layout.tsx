// apps/web/src/app/(app)/layout.tsx
import { type ReactNode, Suspense } from "react";

import { GuardSkeleton, RouteGuard } from "@/components/auth/route-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={<GuardSkeleton />}>
			<RouteGuard>{children}</RouteGuard>
		</Suspense>
	);
}
