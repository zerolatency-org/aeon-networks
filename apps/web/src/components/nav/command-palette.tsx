// apps/web/src/components/nav/command-palette.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useMemo } from "react";

import { type CommandItem, commandItems } from "@/lib/nav";
import { useSession } from "@/lib/use-session";
import { useRunCommand } from "./use-run-command";

const GROUPS = ["Go to", "Account", "Appearance"] as const;

const HEADING =
	"[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-fg-2";

export function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const session = useSession();
	const run = useRunCommand();
	const items = useMemo(() => commandItems(session.status), [session.status]);

	function select(item: CommandItem) {
		onOpenChange(false);
		void run(item);
	}

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="bg-canvas/60 fixed inset-0 z-40" />
				<Dialog.Content
					aria-describedby={undefined}
					className="glass fixed top-[18vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-xl p-2 outline-none"
				>
					<Dialog.Title className="sr-only">Command palette</Dialog.Title>
					<Command label="Command palette" loop>
						<Command.Input
							placeholder="Search pages and actions…"
							className="text-fg placeholder:text-fg-3 h-11 w-full bg-transparent px-3 text-[15px] outline-none"
						/>
						<Command.List className="max-h-[320px] overflow-y-auto p-1">
							<Command.Empty className="text-fg-2 px-3 py-6 text-center">
								Nothing matches.
							</Command.Empty>
							{GROUPS.map((group) => {
								const rows = items.filter((i) => i.group === group);
								if (rows.length === 0) return null;
								return (
									<Command.Group
										key={group}
										heading={group}
										className={HEADING}
									>
										{rows.map((item) => (
											<Command.Item
												key={item.id}
												value={item.label}
												onSelect={() => select(item)}
												className="text-fg data-[selected=true]:bg-surface-2 flex h-10 cursor-pointer items-center rounded-md px-3 text-[15px]"
											>
												{item.label}
											</Command.Item>
										))}
									</Command.Group>
								);
							})}
						</Command.List>
					</Command>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
