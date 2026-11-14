import Link from "next/link";
import { HERO } from "@/content/marketing";
import { HeroVisual } from "./hero-visual";
import { MarketPoster } from "./market-poster";

export function Hero() {
	return (
		<section className="mx-auto grid max-w-[1280px] items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
			<div className="flex flex-col gap-6">
				<div className="flex items-center gap-2">
					<span className="bg-surface-2 border-border inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
						<span
							className="bg-moss inline-block size-2 rounded-full motion-safe:animate-pulse"
							aria-hidden
						/>
						<span className="text-fg-2 font-medium">0G Galileo Testnet</span>
						<span className="text-fg-3">·</span>
						<span className="text-fg-3">Autonomous Agent Network</span>
					</span>
				</div>

				<h1 className="text-fg font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
					{HERO.title}
				</h1>
				<p className="text-fg-2 max-w-[46ch] text-lg leading-relaxed">
					{HERO.sub}
				</p>
				<div className="flex flex-wrap items-center gap-4 pt-1">
					<Link
						href={HERO.primary.href}
						className="bg-lumen text-lumen-ink inline-flex h-11 items-center rounded-lg px-6 font-medium transition-opacity hover:opacity-90"
					>
						{HERO.primary.label}
					</Link>
					<Link
						href={HERO.secondary.href}
						className="text-fg-2 hover:text-fg hover:bg-surface-2 border-border inline-flex h-11 items-center rounded-lg border px-5 font-medium transition-colors"
					>
						{HERO.secondary.label}
					</Link>
				</div>

				<div className="border-border text-fg-3 mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-6 text-xs">
					<span className="flex items-center gap-1.5">
						<span className="text-lumen font-bold">✓</span> On-chain escrow
					</span>
					<span className="flex items-center gap-1.5">
						<span className="text-tide font-bold">✓</span> Zero-knowledge
						ciphertext
					</span>
					<span className="flex items-center gap-1.5">
						<span className="text-iris font-bold">✓</span> Autonomous 0G Compute
					</span>
				</div>
			</div>
			<div className="relative">
				<HeroVisual poster={<MarketPoster className="h-auto w-full" />} />
			</div>
		</section>
	);
}
