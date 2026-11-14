// apps/web/src/components/jobs/hire-wizard.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { keccak256, toHex } from "viem";
import { usePublicClient, useSendTransaction } from "wagmi";

import { AgentFace } from "@/components/agents/agent-face";
import {
	card,
	errorText,
	field,
	hint,
	primary,
} from "@/components/agents/styles";
import type { Hex } from "@/lib/agents-parse";
import { avatarTint } from "@/lib/avatar";
import { formatOg } from "@/lib/format";
import { type EvaluatorChoice, validateHireForm } from "@/lib/hire-form";
import {
	createDefaultHireDeps,
	type HireEvent,
	type HireSession,
	newHireSession,
	runHire,
} from "@/lib/hire-runner";
import { fetchMarketAgent } from "@/lib/market-api";

export function HireWizard({
	preselectedTokenId,
}: {
	preselectedTokenId?: string;
}) {
	const router = useRouter();
	const { sendTransactionAsync } = useSendTransaction();
	const publicClient = usePublicClient();

	const [tokenId, setTokenId] = useState(preselectedTokenId ?? "7");
	const [brief, setBrief] = useState("");
	const [budget0G, setBudget0G] = useState("0.01");
	const [evaluatorChoice, setEvaluatorChoice] =
		useState<EvaluatorChoice>("verifier");
	const [customEvaluator, setCustomEvaluator] = useState("");

	const [step, setStep] = useState<HireEvent["step"] | "idle">("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const sessionRef = useRef<HireSession>(newHireSession());
	const busyRef = useRef(false);

	const agentQuery = useQuery({
		queryKey: ["market", "agents", tokenId],
		queryFn: () => fetchMarketAgent(tokenId),
		enabled: Boolean(tokenId),
	});

	const agent = agentQuery.data;

	const deps = useMemo(
		() =>
			createDefaultHireDeps(
				async (tx) => {
					const hash = await sendTransactionAsync({
						to: tx.to as Hex,
						data: tx.data as Hex,
						value: tx.value ? BigInt(tx.value) : 0n,
						chainId: tx.chainId,
					});
					return hash as Hex;
				},
				async (hash) => {
					if (!publicClient) throw new Error("No chain client available");
					const receipt = await publicClient.waitForTransactionReceipt({
						hash,
					});
					return receipt.status;
				},
			),
		[sendTransactionAsync, publicClient],
	);

	const minPriceWei = 10n ** 15n;
	const agentPriceWei = agent ? BigInt(agent.price) : minPriceWei;

	const validation = validateHireForm({
		brief,
		budget0G,
		evaluatorChoice,
		customEvaluatorAddress: customEvaluator,
		verifierAddress: agent?.hire?.verifier ?? undefined,
		minPriceWei,
		agentPriceWei,
	});

	const handleHire = async () => {
		if (busyRef.current || !validation.valid || !validation.data || !agent)
			return;

		busyRef.current = true;
		setErrorMessage(null);

		// Build simple mock encrypted envelope for task delivery
		const taskText = validation.data.brief;
		const taskHash = keccak256(toHex(taskText));
		const envelope = {
			v: 1,
			alg: "A256GCM",
			iv: "0x1234",
			ct: toHex(taskText),
			aad: {
				chainId: agent.hire?.chainId ?? 16602,
				escrow: agent.hire?.escrow ?? "0x",
				tokenId: agent.tokenId,
				client: agent.owner,
				kind: "task",
			},
			keys: {},
		};

		const draft = {
			tokenId: agent.tokenId,
			taskBrief: taskText,
			amountWei: validation.data.budgetWei.toString(),
			evaluatorAddress: validation.data.evaluatorAddress,
			taskHash,
			envelope,
		};

		try {
			const res = await runHire(draft, sessionRef.current, deps, (event) => {
				setStep(event.step);
				if (event.problem) {
					setErrorMessage(event.problem.message);
				}
			});

			if (res.ok) {
				router.push(`/jobs/${res.job.jobId}`);
			} else {
				setErrorMessage(res.problem.message);
			}
		} catch (err: unknown) {
			setErrorMessage((err as Error).message || "Hire process failed");
		} finally {
			busyRef.current = false;
		}
	};

	const face = {
		kind: "dicebear" as const,
		seed: tokenId,
		bg: avatarTint(tokenId),
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="font-serif text-3xl font-semibold">Hire Agent</h1>
				<p className="text-fg-2 mt-1 text-sm">
					Create an on-chain escrow job for an autonomous agent.
				</p>
			</div>

			{/* Agent Summary Card */}
			{agent && (
				<div className={card}>
					<div className="flex items-center gap-4">
						<AgentFace face={face} size={54} />
						<div>
							<div className="flex items-center gap-2">
								<h2 className="font-serif text-lg font-medium">{agent.name}</h2>
								<span className="text-fg-3 font-mono text-xs">
									#{agent.tokenId}
								</span>
							</div>
							<p className="text-fg-2 line-clamp-1 text-xs">
								{agent.description}
							</p>
							<span className="num text-fg mt-1 block font-mono text-xs font-semibold">
								Listing Price: {formatOg(BigInt(agent.price))} 0G
							</span>
						</div>
					</div>
				</div>
			)}

			<form
				className={`${card} space-y-5`}
				onSubmit={(e) => e.preventDefault()}
			>
				{/* Token ID input if not preselected */}
				{!preselectedTokenId && (
					<div>
						<label
							htmlFor="hire-token-id"
							className="mb-1 block text-sm font-medium"
						>
							Agent Token ID
						</label>
						<input
							id="hire-token-id"
							className={`${field} num`}
							value={tokenId}
							onChange={(e) => setTokenId(e.target.value)}
							placeholder="7"
						/>
					</div>
				)}

				{/* Brief */}
				<div>
					<label
						htmlFor="hire-brief"
						className="mb-1 block text-sm font-medium"
					>
						Task Brief / Instructions
					</label>
					<textarea
						id="hire-brief"
						rows={4}
						className={field}
						value={brief}
						onChange={(e) => setBrief(e.target.value)}
						placeholder="Describe the exact requirements and deliverable expected from this agent..."
					/>
					{validation.errors.brief && (
						<p className={errorText}>{validation.errors.brief}</p>
					)}
					<p className={`${hint} mt-1`}>
						Task briefs are end-to-end encrypted before being stored in 0G
						mailbox.
					</p>
				</div>

				{/* Budget */}
				<div>
					<label
						htmlFor="hire-budget"
						className="mb-1 block text-sm font-medium"
					>
						Escrow Budget (0G)
					</label>
					<input
						id="hire-budget"
						className={`${field} num`}
						inputMode="decimal"
						value={budget0G}
						onChange={(e) => setBudget0G(e.target.value)}
					/>
					{validation.errors.budget && (
						<p className={errorText}>{validation.errors.budget}</p>
					)}
					{agent && (
						<p className={`${hint} mt-1`}>
							Must meet listing fee of {formatOg(BigInt(agent.price))} 0G.
						</p>
					)}
				</div>

				{/* Evaluator choice */}
				<div>
					<span className="mb-2 block text-sm font-medium">
						Verification Evaluator
					</span>
					<div className="space-y-2 text-sm">
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="radio"
								name="evaluator"
								value="verifier"
								checked={evaluatorChoice === "verifier"}
								onChange={() => setEvaluatorChoice("verifier")}
							/>
							<span>Aeon Verifier (Automated neutral verification)</span>
						</label>
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="radio"
								name="evaluator"
								value="custom"
								checked={evaluatorChoice === "custom"}
								onChange={() => setEvaluatorChoice("custom")}
							/>
							<span>Custom Evaluator Address (Self or agent)</span>
						</label>
					</div>

					{evaluatorChoice === "custom" && (
						<div className="mt-3">
							<input
								className={`${field} font-mono text-xs`}
								value={customEvaluator}
								onChange={(e) => setCustomEvaluator(e.target.value)}
								placeholder="0x..."
							/>
							{validation.errors.evaluator && (
								<p className={errorText}>{validation.errors.evaluator}</p>
							)}
						</div>
					)}
				</div>

				{errorMessage && <p className={errorText}>{errorMessage}</p>}

				{step !== "idle" && step !== "done" && (
					<div className="bg-surface-2/60 border-border rounded-lg border p-3 text-sm">
						<span className="text-fg-2">
							{step === "prepare" && "Preparing escrow parameters..."}
							{step === "send" &&
								"Approve escrow funding in your connected wallet..."}
							{step === "mining" &&
								"Waiting for escrow deposit to confirm on 0G..."}
							{step === "confirm" && "Registering job with Aeon server..."}
							{step === "deliver" &&
								"Encrypting and delivering task payload..."}
						</span>
					</div>
				)}

				<div className="pt-2">
					<button
						type="button"
						disabled={!validation.valid || (step !== "idle" && step !== "done")}
						onClick={handleHire}
						className={primary}
					>
						Fund Escrow & Submit Task ({budget0G} 0G)
					</button>
				</div>
			</form>
		</div>
	);
}
