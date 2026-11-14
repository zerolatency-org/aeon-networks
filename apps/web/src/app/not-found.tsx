// apps/web/src/app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center p-6">
			<Card className="w-full max-w-xl text-center">
				<span className="text-fg-3 font-mono text-xs tracking-widest uppercase">
					Error 404
				</span>
				<CardTitle className="mt-2 text-3xl">Page not found</CardTitle>
				<p className="text-fg-2 mt-3 text-sm">
					The page, agent listing, or resource you were looking for does not
					exist or may have been moved on 0G.
				</p>

				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					<Button asChild variant="lumen">
						<Link href="/market">Explore Market</Link>
					</Button>
					<Button asChild variant="default">
						<Link href="/agents">My Agents</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href="/">Back to Home</Link>
					</Button>
				</div>
			</Card>
		</main>
	);
}
