// apps/web/src/components/agents/tabs/listing-tab.tsx
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { usePublicClient, useSendTransaction } from "wagmi";

import type { AgentView, Hex } from "@/lib/agents-parse";
import {
	checkPrice,
	DEFAULT_MIN_PRICE,
	priceProblem,
} from "@/lib/listing-form";
import {
	createDefaultListingDeps,
	type ListingEvent,
	type ListingSession,
	newListingSession,
	runListing,
} from "@/lib/listing-runner";
import { ogText } from "@/lib/policy-form";
import { card, errorText, field, hint, primary, quiet } from "../styles";

async function fetchMinPrice(): Promise<bigint> {
	try {
		const res = await fetch("/api/market/min-price", {
			credentials: "include",
		});
		if (!res.ok) return DEFAULT_MIN_PRICE;
		const data = (await res.json()) as { minPriceWei?: string };
		return data.minPriceWei ? BigInt(data.minPriceWei) : DEFAULT_MIN_PRICE;
	} catch {
		return DEFAULT_MIN_PRICE;
	}
}

async function fetchListing(tokenId: string) {
	try {
		const res = await fetch(`/api/market/agents/${tokenId}`, {
			credentials: "include",
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

export function ListingTab({ agent }: { agent: AgentView }) {
	const queryClient = useQueryClient();
	const { sendTransactionAsync } = useSendTransaction();
	const publicClient = usePublicClient();

	const minPriceQuery = useQuery({
		queryKey: ["market", "min-price"],
		queryFn: fetchMinPrice,
		staleTime: 60_000,
	});

	const listingQuery = useQuery({
		queryKey: ["market", "agents", agent.tokenId],
		queryFn: () => fetchListing(agent.tokenId),
	});

	const minPrice = minPriceQuery.data ?? DEFAULT_MIN_PRICE;
	const existingListing = listingQuery.data;

	const [price, setPrice] = useState("0.01");
	const [tagsInput, setTagsInput] = useState("research, analysis");
	const [step, setStep] = useState<ListingEvent["step"] | "idle">("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const sessionRef = useRef<ListingSession>(newListingSession());
	const busyRef = useRef(false);

	const deps = useMemo(
		() =>
			createDefaultListingDeps(
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

	const check = checkPrice(price, minPrice);

	const handleExecute = async (action: "list" | "update" | "delist") => {
		if (busyRef.current) return;
		if (action !== "delist" && !check.ok) return;

		busyRef.current = true;
		setErrorMessage(null);

		const tags = tagsInput
			.split(",")
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean);

		const draft = {
			agentId: agent.id,
			action,
			priceWei: check.ok ? check.wei.toString() : undefined,
			tags,
		};

		try {
			const res = await runListing(draft, sessionRef.current, deps, (event) => {
				setStep(event.step);
				if (event.problem) {
					setErrorMessage(event.problem.message);
				}
			});

			if (res.ok) {
				sessionRef.current = newListingSession();
				await queryClient.invalidateQueries({
					queryKey: ["market", "agents", agent.tokenId],
				});
			} else {
				setErrorMessage(res.problem.message);
			}
		} catch (err) {
			setErrorMessage(priceProblem(err));
		} finally {
			busyRef.current = false;
		}
	};

	return (
		<div className="space-y-6">
			<div className={card}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-serif text-2xl">Marketplace listing</h2>
					{existingListing && (
						<span className="bg-moss/10 text-moss rounded-full px-2.5 py-0.5 text-xs font-medium">
							Listed on Market
						</span>
					)}
				</div>
				<p className={`${hint} mt-1`}>
					Offer this agent&apos;s capabilities on the 0G marketplace so other
					users and agents can hire it.
				</p>

				{existingListing && (
					<div className="bg-surface-2 border-border my-4 rounded-lg border p-4 text-sm">
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<div>
								<span className="text-fg-3 block text-xs">Current price</span>
								<span className="text-fg font-mono font-medium">
									{ogText(BigInt(existingListing.price))} 0G
								</span>
							</div>
							<div>
								<span className="text-fg-3 block text-xs">Jobs finished</span>
								<span className="text-fg font-mono font-medium">
									{existingListing.jobsCompleted}
								</span>
							</div>
							<div>
								<span className="text-fg-3 block text-xs">Jobs disputed</span>
								<span className="text-fg font-mono font-medium">
									{existingListing.jobsDisputed}
								</span>
							</div>
							<div>
								<span className="text-fg-3 block text-xs">Tags</span>
								<span className="text-fg text-xs">
									{(existingListing.tags ?? []).join(", ") || "None"}
								</span>
							</div>
						</div>
					</div>
				)}

				<form className="mt-6 space-y-5" onSubmit={(e) => e.preventDefault()}>
					<div>
						<label htmlFor="listing-price" className="mb-1 block font-medium">
							Job price (0G)
						</label>
						<input
							id="listing-price"
							className={`${field} num`}
							inputMode="decimal"
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							disabled={step !== "idle" && step !== "done" && step !== "failed"}
						/>
						<p className={`${hint} mt-1`}>
							Registry minimum is{" "}
							<span className="num">{ogText(minPrice)} 0G</span> per job.
						</p>
						{!check.ok && price !== "" && (
							<p className={errorText}>{check.message}</p>
						)}
					</div>

					<div>
						<label htmlFor="listing-tags" className="mb-1 block font-medium">
							Tags <span className="text-fg-3">(comma separated, max 8)</span>
						</label>
						<input
							id="listing-tags"
							className={field}
							value={tagsInput}
							onChange={(e) => setTagsInput(e.target.value)}
							placeholder="research, summarization, finance"
							disabled={step !== "idle" && step !== "done" && step !== "failed"}
						/>
					</div>

					{errorMessage && <p className={errorText}>{errorMessage}</p>}

					{step !== "idle" && step !== "done" && (
						<div className="bg-surface-2/60 border-border rounded-lg border p-3 text-sm">
							<span className="text-fg-2">
								{step === "prepare" && "Preparing registration transaction..."}
								{step === "send" &&
									"Approve the listing transaction in your wallet..."}
								{step === "mining" && "Broadcasting transaction to 0G chain..."}
								{step === "confirm" &&
									"Verifying registration with registry..."}
							</span>
						</div>
					)}

					{step === "done" && (
						<div className="bg-moss/10 text-moss rounded-lg p-3 text-sm">
							Listing updated successfully on the 0G Marketplace.
						</div>
					)}

					<div className="flex flex-wrap items-center gap-3 pt-2">
						<button
							type="button"
							className={primary}
							disabled={
								!check.ok ||
								(step !== "idle" && step !== "done" && step !== "failed")
							}
							onClick={() => handleExecute(existingListing ? "update" : "list")}
						>
							{existingListing ? "Update listing" : "List on market"}
						</button>

						{existingListing && (
							<button
								type="button"
								className={quiet}
								disabled={
									step !== "idle" && step !== "done" && step !== "failed"
								}
								onClick={() => handleExecute("delist")}
							>
								Delist from market
							</button>
						)}
					</div>
					<p className={`${hint} mt-2`}>
						Registration broadcasts an on-chain listing transaction to the 0G
						Marketplace Registry.
					</p>
				</form>
			</div>

			<div className={card}>
				<h3 className="font-serif text-lg">Understanding the four prices</h3>
				<dl className="divide-border mt-3 divide-y text-sm">
					<div className="py-2.5 first:pt-0">
						<dt className="text-fg font-medium">1. Model run cost</dt>
						<dd className="text-fg-2">
							Incurred when your agent runs its LLM ({agent.model}). Charged per
							million tokens.
						</dd>
					</div>
					<div className="py-2.5">
						<dt className="text-fg font-medium">2. Listing price</dt>
						<dd className="text-fg-2">
							What a buyer pays your agent per job. Set here, earned once
							verification passes.
						</dd>
					</div>
					<div className="py-2.5">
						<dt className="text-fg font-medium">3. Market minimum</dt>
						<dd className="text-fg-2">
							The floor price enforced by the registry smart contract (
							{ogText(minPrice)} 0G).
						</dd>
					</div>
					<div className="py-2.5 last:pb-0">
						<dt className="text-fg font-medium">4. Spending limits</dt>
						<dd className="text-fg-2">
							Defined in the Policy tab. Caps what your agent may spend when it
							hires sub-agents.
						</dd>
					</div>
				</dl>
			</div>
		</div>
	);
}
