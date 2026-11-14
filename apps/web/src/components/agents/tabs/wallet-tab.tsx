// apps/web/src/components/agents/tabs/wallet-tab.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSendTransaction } from "wagmi";

import type { AgentView, Hex } from "@/lib/agents-parse";
import { formatOg } from "@/lib/format";
import {
	checkSweepAmount,
	DEFAULT_GAS_RESERVE,
	maxSweepable,
	quickSweepAmounts,
} from "@/lib/sweep-form";
import { useSession } from "@/lib/use-session";

import { FundStep } from "../steps/fund-step";
import { card, errorText, field, hint, primary } from "../styles";

export function WalletTab({ agent }: { agent: AgentView }) {
	const session = useSession();
	const queryClient = useQueryClient();
	const { sendTransactionAsync } = useSendTransaction();

	const balanceWei = agent.balanceWei ? BigInt(agent.balanceWei) : 0n;
	const maxSweep = maxSweepable(balanceWei, DEFAULT_GAS_RESERVE);
	const quicks = quickSweepAmounts(balanceWei, DEFAULT_GAS_RESERVE);

	const [amount, setAmount] = useState(
		maxSweep > 0n ? formatOg(maxSweep) : "0",
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const check = checkSweepAmount(amount, balanceWei, DEFAULT_GAS_RESERVE);

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

	const handleSweep = async () => {
		if (busy || !check.ok || !check.wei) return;
		setBusy(true);
		setError(null);
		setSuccess(false);

		try {
			// Find owner wallet
			const ownerAddr =
				session.status === "ready" ? session.wallet.address : null;

			if (!ownerAddr) {
				setError("No connected owner wallet to receive swept funds.");
				return;
			}

			// Send sweep transfer
			await sendTransactionAsync({
				to: ownerAddr as Hex,
				value: check.wei,
			});

			setSuccess(true);
			await queryClient.invalidateQueries({ queryKey: ["agents"] });
		} catch (err: unknown) {
			setError((err as Error).message || "Sweep transfer failed.");
		} finally {
			setBusy(false);
		}
	};

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
					connected owner wallet, preserving a gas reserve of{" "}
					{formatOg(DEFAULT_GAS_RESERVE)} 0G.
				</p>

				<div className="bg-surface-2 border-border my-4 rounded-xl border p-4 text-xs">
					<div className="flex items-center justify-between">
						<span className="text-fg-3">Current Agent Balance:</span>
						<span className="text-fg font-mono font-medium">
							{formatOg(balanceWei)} 0G
						</span>
					</div>
					<div className="mt-1 flex items-center justify-between">
						<span className="text-fg-3">Gas Reserve (retained):</span>
						<span className="text-fg font-mono font-medium">
							{formatOg(DEFAULT_GAS_RESERVE)} 0G
						</span>
					</div>
					<div className="border-border mt-2 flex items-center justify-between border-t pt-2">
						<span className="text-fg font-medium">Max Sweepable:</span>
						<span className="text-moss font-mono font-bold">
							{formatOg(maxSweep)} 0G
						</span>
					</div>
				</div>

				<form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
					<div>
						<label
							htmlFor="sweep-amount"
							className="mb-1 block text-sm font-medium"
						>
							Withdraw Amount (0G)
						</label>
						<input
							id="sweep-amount"
							className={`${field} num`}
							inputMode="decimal"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							disabled={maxSweep === 0n || busy}
						/>
						{!check.ok && amount !== "" && (
							<p className={`${errorText} mt-1`}>{check.message}</p>
						)}
					</div>

					{quicks.length > 0 && (
						<div className="flex gap-2">
							{quicks.map((q) => (
								<button
									key={q.percent}
									type="button"
									onClick={() => setAmount(formatOg(q.wei))}
									disabled={busy}
									className="border-border bg-surface-2 hover:bg-surface-3 text-fg rounded-md border px-2.5 py-1 font-mono text-xs"
								>
									{q.label}
								</button>
							))}
						</div>
					)}

					{error && <p className={errorText}>{error}</p>}
					{success && (
						<p className="text-moss text-xs font-medium">
							Funds swept successfully to your owner wallet!
						</p>
					)}

					<div className="pt-2">
						<button
							type="button"
							className={primary}
							disabled={maxSweep === 0n || !check.ok || busy}
							onClick={handleSweep}
						>
							{busy ? "Sweeping funds..." : "Sweep funds to owner wallet"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
