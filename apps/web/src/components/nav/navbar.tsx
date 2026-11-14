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

	return (
		<>
			<header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 px-4 md:px-6">
				<Link
					href="/"
					aria-label="Aeon home"
					className="flex items-center gap-4"
				>
					<Logo />
					<Wordmark />
				</Link>

				<nav
					aria-label="Main"
					className="ml-6 hidden items-center gap-1 md:flex"
				>
					{(session.status === "ready"
						? NAV_ITEMS
						: NAV_ITEMS.filter((item) => item.href === "/market")
					).map((item) => {
						const active = isActive(pathname, item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"relative rounded-md px-3 py-1.5 text-[15px] transition-colors duration-(--dur-fast)",
									active ? "text-fg" : "text-fg-2 hover:text-fg",
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
				</nav>

				<div className="ml-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						aria-label="Open command palette"
						onClick={() => setPaletteOpen(true)}
					>
						<MagnifyingGlass aria-hidden size={18} />
						<kbd className="num text-fg-3 hidden text-[11px] lg:inline">⌘K</kbd>
					</Button>
					<ThemeSwitch />
					<div className="ml-2">
						<AccountSlot />
					</div>
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
			</header>

			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
			<MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
		</>
	);
}
