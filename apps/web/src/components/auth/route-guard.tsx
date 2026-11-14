// apps/web/src/components/auth/route-guard.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { guardDecision, routeAccess } from "@/lib/route-guard";
import { useSession } from "@/lib/use-session";

export function GuardSkeleton() {
	return (
		<main
			aria-busy="true"
			className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-12"
		>
			<Skeleton className="h-10 w-64" />
			<Skeleton className="h-4 w-96 max-w-full" />
			<Skeleton className="h-40 w-full" />
		</main>
	);
}

export function RouteGuard({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const search = useSearchParams().toString();
	const router = useRouter();
	const session = useSession();

	const next = search ? `${pathname}?${search}` : pathname;
	const decision = guardDecision({
		access: routeAccess(pathname),
		session: session.status,
		next,
	});
	const redirectTo = decision.action === "redirect" ? decision.to : null;

	useEffect(() => {
		if (redirectTo) router.replace(redirectTo);
	}, [redirectTo, router]);

	if (decision.action === "allow") return children;

	if (decision.action === "unavailable") {
		return (
			<main className="mx-auto max-w-[1280px] px-6 py-12">
				<Card className="flex max-w-[520px] flex-col gap-3">
					<CardTitle>We can't reach Aeon</CardTitle>
					<p className="text-fg-2">
						The server is not answering. Check that it is running, then reload.
					</p>
					<Button
						className="self-start"
						variant="outline"
						onClick={() => window.location.reload()}
					>
						Reload
					</Button>
				</Card>
			</main>
		);
	}

	return <GuardSkeleton />;
}
