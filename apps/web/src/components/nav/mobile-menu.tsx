// apps/web/src/components/nav/mobile-menu.tsx
"use client";

import { Drawer } from "vaul";

import { commandItems } from "@/lib/nav";
import { useSession } from "@/lib/use-session";
import { useRunCommand } from "./use-run-command";

export function MobileMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const session = useSession();
	const run = useRunCommand();
	const items = commandItems(session.status);

	return (
		<Drawer.Root open={open} onOpenChange={onOpenChange}>
			<Drawer.Portal>
				<Drawer.Overlay className="bg-canvas/60 fixed inset-0 z-40" />
				<Drawer.Content className="glass fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl p-4 outline-none">
					<div
						aria-hidden
						className="bg-border-strong mx-auto mb-4 h-1 w-10 rounded-full"
					/>
					<Drawer.Title className="sr-only">Menu</Drawer.Title>
					<Drawer.Description className="sr-only">
						Pages and account actions
					</Drawer.Description>
					<nav aria-label="Menu" className="flex flex-col overflow-y-auto">
						{items.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => {
									onOpenChange(false);
									void run(item);
								}}
								className="text-fg-2 hover:bg-surface-2 hover:text-fg flex h-11 w-full items-center rounded-md px-3 text-left text-[15px] transition-colors duration-(--dur-fast)"
							>
								{item.label}
							</button>
						))}
					</nav>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
