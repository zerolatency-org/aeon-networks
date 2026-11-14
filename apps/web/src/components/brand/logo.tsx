// apps/web/src/components/brand/logo.tsx
import { cn } from "@/lib/utils";

export function Logo({
	size = 28,
	className,
}: {
	size?: number;
	className?: string;
}) {
	return (
		<>
			{/* biome-ignore lint/performance/noImgElement: SVGs are served directly and are not optimized by Next Image. */}
			<img
				src="/logo.svg"
				alt="Aeon"
				width={431}
				height={512}
				style={{ width: "auto", height: size }}
				className={cn("shrink-0 dark:hidden", className)}
			/>
			{/* biome-ignore lint/performance/noImgElement: SVGs are served directly and are not optimized by Next Image. */}
			<img
				src="/logo-dark.svg"
				alt=""
				aria-hidden="true"
				width={431}
				height={512}
				style={{ width: "auto", height: size }}
				className={cn("hidden shrink-0 dark:block", className)}
			/>
		</>
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
