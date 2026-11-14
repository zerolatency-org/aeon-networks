// apps/web/src/components/settings/settings-view.tsx
"use client";

import type { ReactNode } from "react";

import { useRunCommand } from "@/components/nav/use-run-command";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CommandItem } from "@/lib/nav";
import { displayName } from "@/lib/session";
import { useSession } from "@/lib/use-session";
import { LinkedAccounts } from "./linked-accounts";
import { WalletList } from "./wallet-list";

const SIGN_OUT: CommandItem = {
	id: "sign-out",
	label: "Sign out",
	group: "Account",
	run: { type: "signOut" },
};

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint: string;
	children: ReactNode;
}) {
	return (
		<Card className="flex flex-col gap-4">
			<div>
				<h2 className="font-serif text-[28px] leading-[34px] tracking-tight">
					{title}
				</h2>
				<p className="text-fg-2">{hint}</p>
			</div>
			{children}
		</Card>
	);
}

export function SettingsView() {
	const session = useSession();
	const run = useRunCommand();

	// The route guard only lets these two states in. Anything else is a moment during sign-out.
	if (session.status !== "ready" && session.status !== "needs-wallet")
		return null;

	const wallets = session.status === "ready" ? session.wallets : [];
	const primary =
		session.status === "ready" ? session.wallet.address : undefined;
	const wallet = session.status === "ready" ? session.wallet : undefined;

	return (
		<div className="grid gap-3 md:grid-cols-2">
			<Section
				title="Sign-in methods"
				hint="Connect another account so you can still get in if you lose one."
			>
				<LinkedAccounts walletCount={wallets.length} />
			</Section>

			<Section title="Wallets" hint="Aeon hires and pays with a linked wallet.">
				<WalletList wallets={wallets} primary={primary} />
			</Section>

			<Card className="flex flex-wrap items-center gap-4 md:col-span-2">
				<div>
					<p className="font-medium">{displayName(session.user, wallet)}</p>
					{session.user.email ? (
						<p className="text-fg-2 text-[13px] leading-5">
							{session.user.email}
						</p>
					) : null}
				</div>
				<Button
					className="ml-auto"
					variant="outline"
					onClick={() => void run(SIGN_OUT)}
				>
					Sign out
				</Button>
			</Card>
		</div>
	);
}
