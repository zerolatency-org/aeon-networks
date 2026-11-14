// apps/web/src/app/global-error.tsx
"use client";

import { Button } from "@/components/ui/button";
import { formatErrorDetails, formatErrorHeadline } from "@/lib/error-view";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const headline = formatErrorHeadline(error);
	const details = formatErrorDetails(error);

	return (
		<html lang="en">
			<body className="bg-bg text-fg font-sans antialiased">
				<main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center p-6 text-center">
					<div className="border-border bg-surface-1 rounded-lg border p-8 shadow-sm">
						<span className="text-coral font-mono text-xs tracking-widest uppercase">
							Critical Failure
						</span>
						<h1 className="mt-2 font-serif text-3xl font-normal tracking-tight">
							{headline}
						</h1>
						<p className="text-fg-2 mt-3 text-sm">{details}</p>

						<div className="mt-6 flex justify-center gap-3">
							<Button variant="lumen" onClick={() => reset()}>
								Reload application
							</Button>
						</div>
					</div>
				</main>
			</body>
		</html>
	);
}
