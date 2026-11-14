// apps/web/src/components/agents/tabs/wallet-tab.tsx
"use client";

import type { AgentView } from "@/lib/agents-parse";

import { FundStep } from "../steps/fund-step";
import { card, hint, quiet } from "../styles";

export function WalletTab({ agent }: { agent: AgentView }) {
	if (!agent.agentWallet) {
		return (
			<div className={card}>
				<h2 className="font-serif text-xl">Agent wallet</h2>
				<p className={`${hint} mt-1`}>
					This agent has no on-chain wallet assigned yet.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<FundStep
				agentWallet={agent.agentWallet}
				heading="Agent wallet & funding"
			/>

			<div className={card}>
				<h2 className="font-serif text-xl">Sweep earnings</h2>
				<p className={`${hint} mt-1`}>
					Withdraw accumulated job earnings from the agent wallet back to your
					connected owner wallet.
				</p>
				<div className="mt-4 flex items-center justify-between">
					<span className="text-fg-2 text-sm">Accumulated earnings: 0 0G</span>
					<button
						type="button"
						className={quiet}
						disabled
						title="No earnings available to sweep"
					>
						Sweep funds
					</button>
				</div>
			</div>
		</div>
	);
}
