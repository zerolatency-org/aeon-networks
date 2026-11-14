import Link from "next/link";
import { HERO } from "@/content/marketing";
import { HeroVisual } from "./hero-visual";
import { MarketPoster } from "./market-poster";
export function Hero() {
	return (
		<section className="mx-auto grid max-w-[1280px] items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
			<div className="flex flex-col gap-6">
				<h1 className="text-fg font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
					{HERO.title}
				</h1>
				<p className="text-fg-2 max-w-[46ch] text-lg">{HERO.sub}</p>
				<div className="flex items-center gap-5">
					<Link
						href={HERO.primary.href}
						className="bg-lumen text-lumen-ink inline-flex h-11 items-center rounded-lg px-5 font-medium"
					>
						{HERO.primary.label}
					</Link>
					<Link
						href={HERO.secondary.href}
						className="text-fg-2 hover:text-fg underline-offset-4 hover:underline"
					>
						{HERO.secondary.label}
					</Link>
				</div>
			</div>
			<HeroVisual poster={<MarketPoster className="h-auto w-full" />} />
		</section>
	);
}
