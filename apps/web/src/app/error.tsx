// apps/web/src/app/error.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatErrorDetails, formatErrorHeadline } from "@/lib/error-view";

export default function ErrorBoundary({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log safely to console in development
		if (process.env.NODE_ENV !== "production") {
			console.error("ErrorBoundary caught:", error);
		}
	}, [error]);

	const headline = formatErrorHeadline(error);
	const details = formatErrorDetails(error);

	return (
		<main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center p-6">
			<Card className="w-full max-w-xl text-center">
				<span className="text-coral font-mono text-xs tracking-widest uppercase">
					System Interrupted
				</span>
				<CardTitle className="mt-2 text-3xl">{headline}</CardTitle>
				<p className="text-fg-2 mt-3 text-sm">{details}</p>

				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					<Button variant="lumen" onClick={() => reset()}>
						Try again
					</Button>
					<Button asChild variant="outline">
						<Link href="/">Back to Home</Link>
					</Button>
				</div>
			</Card>
		</main>
	);
}
