// apps/web/src/components/jobs/job-actions.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePublicClient, useSendTransaction } from "wagmi";

import { errorText, primary, quiet } from "@/components/agents/styles";
import type { Hex } from "@/lib/agents-parse";
import { whoMayActNext } from "@/lib/job-state";
import {
	type JobAction,
	type JobDetailView,
	jobErrorWords,
	prepareJobAction,
} from "@/lib/jobs-api";

export function JobActions({ job }: { job: JobDetailView }) {
	const queryClient = useQueryClient();
	const { sendTransactionAsync } = useSendTransaction();
	const publicClient = usePublicClient();

	const [busy, setBusy] = useState(false);
	const [activeAction, setActiveAction] = useState<JobAction | null>(null);
	const [error, setError] = useState<string | null>(null);

	const actions = whoMayActNext(job);
	if (actions.length === 0) return null;

	const handleAction = async (action: JobAction) => {
		if (busy) return;
		setBusy(true);
		setError(null);
		setActiveAction(action);

		try {
			// 1. Prepare action transaction on backend
			const prepared = await prepareJobAction(job.jobId, action);

			// 2. Broadcast on-chain via wallet
			const hash = await sendTransactionAsync({
				to: prepared.tx.to as Hex,
				data: prepared.tx.data as Hex,
				value: prepared.tx.value ? BigInt(prepared.tx.value) : 0n,
				chainId: prepared.tx.chainId,
			});

			// 3. Wait for receipt
			if (publicClient) {
				await publicClient.waitForTransactionReceipt({ hash });
			}

			// 4. Invalidate and refresh query
			await queryClient.invalidateQueries({ queryKey: ["jobs", job.jobId] });
			await queryClient.invalidateQueries({ queryKey: ["jobs"] });
		} catch (err: unknown) {
			const errCode = (err as { code?: string })?.code || "ACTION_FAILED";
			setError(jobErrorWords(errCode));
		} finally {
			setBusy(false);
			setActiveAction(null);
		}
	};

	return (
		<div className="border-border bg-surface-1 rounded-xl border p-5">
			<h3 className="font-serif text-lg font-medium">Available Actions</h3>
			<p className="text-fg-3 mt-1 text-xs">
				Perform on-chain actions according to your role on this escrow contract.
			</p>

			{error && <p className={`${errorText} mt-3`}>{error}</p>}

			<div className="mt-4 flex flex-wrap items-center gap-3">
				{actions.includes("complete") && (
					<button
						type="button"
						disabled={busy}
						onClick={() => handleAction("complete")}
						className={primary}
					>
						{busy && activeAction === "complete"
							? "Releasing escrow..."
							: "Accept & Release Escrow"}
					</button>
				)}

				{actions.includes("dispute") && (
					<button
						type="button"
						disabled={busy}
						onClick={() => handleAction("dispute")}
						className="border-ember/40 bg-ember/10 text-ember hover:bg-ember/20 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
					>
						{busy && activeAction === "dispute"
							? "Submitting dispute..."
							: "Dispute Deliverable"}
					</button>
				)}

				{actions.includes("decline") && (
					<button
						type="button"
						disabled={busy}
						onClick={() => handleAction("decline")}
						className={quiet}
					>
						{busy && activeAction === "decline"
							? "Declining..."
							: "Decline Job"}
					</button>
				)}

				{actions.includes("claimTimeout") && (
					<button
						type="button"
						disabled={busy}
						onClick={() => handleAction("claimTimeout")}
						className={primary}
					>
						{busy && activeAction === "claimTimeout"
							? "Claiming refund..."
							: "Claim Timeout Refund"}
					</button>
				)}
			</div>
		</div>
	);
}
