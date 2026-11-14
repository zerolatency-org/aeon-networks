// apps/web/src/components/agents/steps/review-step.tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { FALLBACK_MODELS, loadModels, modelKeys } from "@/lib/models";
import type { NetworkState } from "@/lib/network";
import { reviewRows, reviewStatus } from "@/lib/review";
import { STEPS, type WizardDraft } from "@/lib/wizard";

import { card, hint, primary, quiet } from "../styles";

type Props = {
	draft: WizardDraft;
	network: NetworkState;
	onEdit: (step: number) => void;
	onSwitchNetwork: () => void;
	onMint: () => void;
};

export function ReviewStep({
	draft,
	network,
	onEdit,
	onSwitchNetwork,
	onMint,
}: Props) {
	const { data } = useQuery({
		queryKey: modelKeys.all,
		queryFn: () => loadModels(),
		staleTime: 5 * 60_000,
	});
	const rows = reviewRows(draft, data?.models ?? FALLBACK_MODELS);
	const status = reviewStatus(draft);

	return (
		<div className="space-y-6">
			<dl className={`${card} divide-border divide-y`}>
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
					>
						<div>
							<dt className="text-fg-2 text-sm">{row.label}</dt>
							<dd>{row.value}</dd>
							{row.details.map((line) => (
								<dd key={line} className="text-fg-2 text-sm">
									{line}
								</dd>
							))}
						</div>
						<button
							type="button"
							className="text-lumen-fg text-sm underline"
							onClick={() => onEdit(row.step)}
						>
							Edit
						</button>
					</div>
				))}
			</dl>

			<p className={hint}>
				You will approve two transactions in your wallet: the mint, then a
				second one that lets the agent sign its own jobs. The mint fee is shown
				before you pay.
			</p>

			{!status.ready ? (
				<button
					type="button"
					className={quiet}
					onClick={() => onEdit(status.fixStep ?? 0)}
				>
					Fix {STEPS[status.fixStep ?? 0]} first
				</button>
			) : network === "disconnected" ? (
				<p className="text-ember">Connect your wallet to mint.</p>
			) : network === "wrong-network" ? (
				<button type="button" className={primary} onClick={onSwitchNetwork}>
					Switch to 0G Galileo
				</button>
			) : (
				<button type="button" className={primary} onClick={onMint}>
					Mint agent
				</button>
			)}
		</div>
	);
}
