"use client";

import {
	CheckCircle,
	Coins,
	Cpu,
	ShieldCheck,
	User,
} from "@phosphor-icons/react";
import { LANES } from "@/content/marketing";
import type { SceneId } from "@/lib/story";
import { useVaultDemo } from "./use-vault-demo";
import { VaultViz } from "./vault-viz";

export function SceneVisual({ id }: { id: SceneId }) {
	const vaultState = useVaultDemo(true);

	if (id === "own")
		return (
			<div className="bg-surface-1 border-border flex flex-col items-center justify-center gap-4 rounded-xl border p-8 md:flex-row md:gap-8">
				{/* Step 1: You */}
				<div className="bg-surface-2 border-border flex min-w-[140px] flex-col items-center rounded-xl border p-4 text-center">
					<div className="bg-lumen text-lumen-ink rounded-lg p-2.5">
						<User size={24} weight="bold" />
					</div>
					<p className="text-fg mt-2 text-sm font-medium">You</p>
					<p className="text-fg-3 mt-0.5 text-xs">Private Key Holder</p>
				</div>

				<span className="text-lumen font-mono text-xl font-bold">→</span>

				{/* Step 2: Agent Token */}
				<div className="bg-surface-2 border-border flex min-w-[140px] flex-col items-center rounded-xl border p-4 text-center">
					<div className="bg-surface-3 text-fg rounded-lg p-2.5">
						<ShieldCheck size={24} weight="duotone" />
					</div>
					<p className="text-fg mt-2 text-sm font-medium">Agent Token</p>
					<p className="text-fg-3 mt-0.5 text-xs">0G ERC-721 NFT</p>
				</div>

				<span className="text-lumen font-mono text-xl font-bold">→</span>

				{/* Step 3: Agent Wallet */}
				<div className="bg-surface-2 border-border flex min-w-[140px] flex-col items-center rounded-xl border p-4 text-center">
					<div className="bg-moss text-lumen-ink rounded-lg p-2.5">
						<Coins size={24} weight="fill" />
					</div>
					<p className="text-fg mt-2 text-sm font-medium">Agent Wallet</p>
					<p className="text-fg-3 mt-0.5 text-xs">Automated Escrow & Payouts</p>
				</div>
			</div>
		);

	if (id === "work") {
		const icons = [User, ShieldCheck, Coins, Cpu, CheckCircle];
		return (
			<div className="bg-surface-1 border-border rounded-xl border p-6">
				<ol className="flex flex-wrap items-center justify-between gap-3">
					{LANES.map((l, i) => {
						const Icon = icons[i] ?? ShieldCheck;
						return (
							<li
								key={l.id}
								className="bg-surface-2 border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
							>
								<div className="bg-surface-3 text-fg rounded-md p-1.5">
									<Icon size={16} weight="duotone" />
								</div>
								<div>
									<p className="text-fg text-xs leading-none font-medium">
										{l.label}
									</p>
									<p className="text-fg-3 mt-1 line-clamp-1 text-[11px]">
										{l.note}
									</p>
								</div>
							</li>
						);
					})}
				</ol>
			</div>
		);
	}

	return <VaultViz state={vaultState} />;
}
