// apps/web/src/components/nav/navbar.tsx
"use client";

import { List, MagnifyingGlass } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo, Wordmark } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/content/marketing";
import { SPRING } from "@/lib/motion";
import { isActive, isCommandShortcut, NAV_ITEMS, showNavbar } from "@/lib/nav";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import { AccountSlot } from "./account-slot";
import { CommandPalette } from "./command-palette";
import { MobileMenu } from "./mobile-menu";

export function Navbar() {
	const pathname = usePathname();
	const session = useSession();
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!isCommandShortcut(e)) return;
			e.preventDefault();
			setPaletteOpen((open) => !open);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!showNavbar(pathname)) return null;

	const items =
		session.status === "ready"
			? NAV_ITEMS
			: NAV_ITEMS.filter((item) => item.href === "/market");

	return (
		<>
			<header className="border-border bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur-md">
				<nav
					aria-label="Main navigation"
					className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-6"
				>
					<div className="flex items-center gap-6">
						<Link
							href="/"
							aria-label="Aeon home"
							className="text-fg flex items-center gap-3"
						>
							<Logo />
							<Wordmark />
						</Link>

						<div className="hidden items-center gap-1 md:flex">
							{items.map((item) => {
								const active = isActive(pathname, item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										aria-current={active ? "page" : undefined}
										className={cn(
											"relative rounded-md px-3 py-1.5 text-sm transition-colors duration-(--dur-fast)",
											active
												? "text-fg font-medium"
												: "text-fg-2 hover:text-fg",
										)}
									>
										{active ? (
											<motion.span
												layoutId="nav-pill"
												transition={SPRING}
												className="bg-surface-2 absolute inset-0 rounded-md"
											/>
										) : null}
										<span className="relative">{item.label}</span>
									</Link>
								);
							})}
							<Link
								href="/how-it-works"
								className={cn(
									"hover:text-fg hidden px-3 py-1.5 text-sm transition-colors sm:inline",
									isActive(pathname, "/how-it-works")
										? "text-fg font-medium"
										: "text-fg-2",
								)}
							>
								How it works
							</Link>
							<Link
								href="/lab"
								className={cn(
									"hover:text-fg hidden px-3 py-1.5 text-sm transition-colors sm:inline",
									isActive(pathname, "/lab")
										? "text-fg font-medium"
										: "text-fg-2",
								)}
							>
								Lab
							</Link>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<a
							className="text-fg-2 hover:text-fg hidden text-sm transition-colors md:inline"
							href={LINKS.github}
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
						<Button
							variant="ghost"
							size="sm"
							aria-label="Open command palette"
							onClick={() => setPaletteOpen(true)}
						>
							<MagnifyingGlass aria-hidden size={18} />
							<kbd className="num text-fg-3 hidden text-[11px] lg:inline">
								⌘K
							</kbd>
						</Button>
						<ThemeSwitch />
						<AccountSlot />
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden"
							aria-label="Open menu"
							onClick={() => setMenuOpen(true)}
						>
							<List aria-hidden size={20} />
						</Button>
					</div>
				</nav>
			</header>

			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
			<MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
		</>
	);
}
