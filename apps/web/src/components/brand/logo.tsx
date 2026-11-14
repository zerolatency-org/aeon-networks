// apps/web/src/components/brand/logo.tsx
import { cn } from "@/lib/utils";

/** Placeholder mark: replace the path with your Aeon logo. Keep it one color, in currentColor. */
export function Logo({
	size = 28,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<svg
			role="img"
			aria-label="Aeon"
			width={size}
			height={size}
			viewBox="0 0 28 28"
			fill="none"
			className={cn("shrink-0", className)}
		>
			<path
				d="M14 4L5 24M14 4l9 20M8.5 17h11"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** The "Aeon" word in the serif. Sits 16 px (gap-4) to the right of the mark. */
export function Wordmark({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"font-serif text-[22px] leading-7 tracking-tight",
				className,
			)}
		>
			Aeon
		</span>
	);
}
