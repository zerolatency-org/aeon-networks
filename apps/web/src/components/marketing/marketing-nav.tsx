import Link from "next/link";
import { Logo, Wordmark } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { LINKS } from "@/content/marketing";

export function MarketingNav() {
	return (
		<header className="border-border bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur-md">
			<nav
				className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-6"
				aria-label="Main navigation"
			>
				<Link
					href="/"
					className="text-fg flex items-center gap-3"
					aria-label="Aeon home"
				>
					<Logo />
					<Wordmark />
				</Link>
				<div className="text-fg-2 flex items-center gap-4 text-sm">
					<Link
						className="hover:text-fg hidden transition-colors sm:inline"
						href="/how-it-works"
					>
						How it works
					</Link>
					<Link
						className="hover:text-fg hidden transition-colors sm:inline"
						href="/lab"
					>
						Lab
					</Link>
					<a
						className="hover:text-fg hidden transition-colors md:inline"
						href={LINKS.github}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<ThemeSwitch />
					<Link
						href="/login"
						className="bg-lumen text-lumen-ink inline-flex h-9 items-center rounded-lg px-4 font-medium transition-opacity hover:opacity-90"
					>
						Launch app
					</Link>
				</div>
			</nav>
		</header>
	);
}
