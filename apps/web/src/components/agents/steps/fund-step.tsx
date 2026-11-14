// apps/web/src/components/agents/steps/fund-step.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import {
	useAccount,
	useBalance,
	usePublicClient,
	useSendTransaction,
} from "wagmi";

import { agentKeys } from "@/lib/agents-api";
import type { Hex } from "@/lib/agents-parse";
import { txUrl } from "@/lib/env";
import {
	balanceStatus,
	balanceText,
	checkFund,
	FUND_PRESETS,
	fundTx,
	pollBalance,
	STATUS_WORDS,
} from "@/lib/fund";
import { walletProblem } from "@/lib/mint-runner";

import { CHAIN_ID } from "../chain";
import { card, errorText, field, hint, primary, quiet } from "../styles";

type Phase = "idle" | "sending" | "waiting" | "arrived" | "slow";
type Props = { agentWallet: Hex; onDone?: () => void; heading?: string };

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export function FundStep({
	agentWallet,
	onDone,
	heading = "Your agent is live",
}: Props) {
	const { address } = useAccount();
	const owner = useBalance({ address });
	const agent = useBalance({ address: agentWallet });
	const { sendTransactionAsync } = useSendTransaction();
	const client = usePublicClient();
	const queryClient = useQueryClient();
	const [amount, setAmount] = useState("0.05");
	const [phase, setPhase] = useState<Phase>("idle");
	const [message, setMessage] = useState<string | null>(null);
	const [lastTx, setLastTx] = useState<Hex | null>(null);

	const check = checkFund(amount, owner.data?.value ?? null);
	const balance = agent.data ? agent.data.value.toString() : null;
	const busy = phase === "sending" || phase === "waiting";

	async function send() {
		if (!check.ok || !client) return;
		setMessage(null);
		setPhase("sending");
		const before = balance;
		let hash: Hex;
		try {
			const tx = fundTx(agentWallet, check.wei, CHAIN_ID);
			hash = await sendTransactionAsync({
				chainId: tx.chainId,
				to: tx.to,
				value: BigInt(tx.value),
				data: tx.data,
			} as never);
		} catch (e) {
			setMessage(walletProblem(e).message);
			setPhase("idle");
			return;
		}
		setLastTx(hash);
		setPhase("waiting");
		try {
			await client.waitForTransactionReceipt({ hash });
			const latest = await pollBalance({
				read: async () =>
					(await agent.refetch()).data?.value.toString() ?? null,
				before,
				sleep,
			});
			const arrived = latest !== null && BigInt(latest) > BigInt(before ?? "0");
			setPhase(arrived ? "arrived" : "slow");
		} catch {
			setPhase("slow");
		}
		void owner.refetch();
		void queryClient.invalidateQueries({ queryKey: agentKeys.all });
	}

	return (
		<div className="space-y-6">
			<div className={card}>
				<h2 className="font-serif text-2xl">{heading}</h2>
				<p className={`${hint} mt-1`}>
					Send it some 0G so it can pay gas and hire other agents. You can skip
					this and do it later.
				</p>
				<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
					<div className="shrink-0 rounded-lg bg-white p-2">
						<QRCodeSVG value={agentWallet} size={100} />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-fg-2 text-sm">Agent wallet</p>
						<div className="mt-1 flex items-center gap-3">
							<code className="num break-all">{agentWallet}</code>
							<button
								type="button"
								className={quiet}
								onClick={() => void navigator.clipboard.writeText(agentWallet)}
							>
								Copy
							</button>
						</div>
						<p className="mt-4">
							<span className="num">{balanceText(balance)} 0G</span>{" "}
							<span className="text-fg-2">
								{STATUS_WORDS[balanceStatus(balance)]}
							</span>
						</p>
					</div>
				</div>
			</div>

			<div className={card}>
				<div className="mb-3 flex flex-wrap gap-2">
					{FUND_PRESETS.map((p) => (
						<button
							type="button"
							key={p}
							className={quiet}
							aria-pressed={amount === p}
							onClick={() => setAmount(p)}
						>
							{p} 0G
						</button>
					))}
				</div>
				<label htmlFor="fund-amount" className="mb-1 block font-medium">
					Amount (0G)
				</label>
				<input
					id="fund-amount"
					className={`${field} num`}
					inputMode="decimal"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
				/>
				{!check.ok && amount !== "" && (
					<p className={errorText}>{check.message}</p>
				)}
				{message && <p className={errorText}>{message}</p>}
				{phase === "waiting" && (
					<p className={`${hint} mt-2`}>Waiting for the transfer to arrive…</p>
				)}
				{phase === "arrived" && (
					<p className="text-moss mt-2">The funds arrived.</p>
				)}
				{phase === "slow" && (
					<p className="text-ember mt-2">
						The transfer was sent but the balance has not changed yet. Check
						again in a moment.
					</p>
				)}
				{lastTx && (
					<a
						className="num text-lumen-fg mt-2 block underline"
						href={txUrl(lastTx)}
						target="_blank"
						rel="noreferrer"
					>
						View transaction
					</a>
				)}
				<div className="mt-4 flex gap-3">
					<button
						type="button"
						className={primary}
						disabled={!check.ok || busy || !client}
						onClick={() => void send()}
					>
						{phase === "sending"
							? "Approve in your wallet…"
							: busy
								? "Sending…"
								: "Send"}
					</button>
					<button
						type="button"
						className={quiet}
						disabled={busy}
						hidden={!onDone}
						onClick={onDone}
					>
						{phase === "arrived" ? "Done" : "Skip for now"}
					</button>
				</div>
			</div>
		</div>
	);
}
