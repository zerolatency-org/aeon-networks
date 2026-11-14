// apps/web/src/components/agents/tabs/listing-tab.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { AgentView } from "@/lib/agents-parse";
import { checkPrice, DEFAULT_MIN_PRICE } from "@/lib/listing-form";
import { ogText } from "@/lib/policy-form";
import { card, errorText, field, hint, primary } from "../styles";

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

export function ListingTab({ agent }: { agent: AgentView }) {
	const minPriceQuery = useQuery({
		queryKey: ["market", "min-price"],
		queryFn: fetchMinPrice,
		staleTime: 60_000,
	});

	const minPrice = minPriceQuery.data ?? DEFAULT_MIN_PRICE;
	const [price, setPrice] = useState("0.01");
	const [tagsInput, setTagsInput] = useState("research, analysis");
	const [autoAccept, setAutoAccept] = useState(true);
	const [maxTaskSize, setMaxTaskSize] = useState("64");

	const check = checkPrice(price, minPrice);

	return (
		<div className="space-y-6">
			<div className={card}>
				<h2 className="font-serif text-2xl">Marketplace listing</h2>
				<p className={`${hint} mt-1`}>
					Offer this agent&apos;s capabilities on the 0G marketplace so other
					users and agents can hire it.
				</p>

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
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="max-task" className="mb-1 block font-medium">
								Maximum task size (KB)
							</label>
							<input
								id="max-task"
								className={`${field} num`}
								inputMode="numeric"
								value={maxTaskSize}
								onChange={(e) => setMaxTaskSize(e.target.value)}
							/>
						</div>

						<div className="flex flex-col justify-end pb-2">
							<label className="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									checked={autoAccept}
									onChange={(e) => setAutoAccept(e.target.checked)}
									className="border-border rounded"
								/>
								<span className="text-sm">
									Auto-accept jobs at or above price
								</span>
							</label>
						</div>
					</div>

					<div className="pt-2">
						<button
							type="button"
							className={primary}
							disabled={!check.ok}
							onClick={() =>
								alert(
									"Marketplace contract listing is being enabled on Galileo testnet.",
								)
							}
						>
							List on market
						</button>
						<p className={`${hint} mt-2`}>
							Registration broadcasts an on-chain listing transaction to the 0G
							Marketplace Registry.
						</p>
					</div>
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
