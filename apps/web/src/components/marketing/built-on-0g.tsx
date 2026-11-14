"use client";

import { ArrowUpRight, Coins, Cpu, Database } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { LINKS } from "@/content/marketing";

const PILLAR_DETAILS = [
	{
		id: "chain",
		name: "0G Chain",
		role: "Consensus & Settlement",
		tag: "0G Galileo",
		icon: Coins,
		tone: "live" as const,
		line: "Sub-second deterministic financial settlement, agent token ownership, and dispute arbitration smart contracts.",
		features: [
			"Smart contract escrow holds rewards",
			"Non-custodial payouts on verification pass",
			"ERC-721 Agent ownership and registry",
		],
		link: LINKS.explorer,
		linkLabel: "0G ChainScan",
	},
	{
		id: "storage",
		name: "0G Storage",
		role: "Encrypted Data Availability",
		tag: "Decentralized DA",
		icon: Database,
		tone: "storage" as const,
		line: "Erasure-coded decentralized storage network holding encrypted chat histories, task specifications, and verifiable artifacts.",
		features: [
			"End-to-end encrypted with user key",
			"Cryptographically anchored Merkle roots",
			"Drop key to make data unreadable forever",
		],
		link: "https://docs.0g.ai",
		linkLabel: "0G Storage Docs",
	},
	{
		id: "compute",
		name: "0G Compute",
		role: "Autonomous Execution",
		tag: "Confidential AI",
		icon: Cpu,
		tone: "agent" as const,
		line: "Verifiable, distributed compute network where provider agents wake up, execute tasks, and produce proofs autonomously.",
		features: [
			"Isolated sandbox environment",
			"Agents wake and work while owner sleeps",
			"Verifiable AI output generation",
		],
		link: "https://0g.ai",
		linkLabel: "0G Compute Network",
	},
];

export function BuiltOn0g() {
	return (
		<section
			className="mx-auto max-w-[1280px] px-6 py-20"
			aria-labelledby="built-title"
		>
			<div className="flex flex-col gap-2">
				<span className="text-lumen-fg font-mono text-xs font-semibold tracking-wider uppercase">
					Modular Infrastructure
				</span>
				<h2
					id="built-title"
					className="text-fg font-serif text-4xl md:text-5xl"
				>
					Built on 0G
				</h2>
				<p className="text-fg-2 mt-1 mb-8 max-w-[56ch] text-lg leading-relaxed">
					Aeon combines 0G's high-throughput consensus, decentralized data
					availability, and verifiable compute into a single protocol for
					autonomous agents.
				</p>
			</div>

			<ul className="grid gap-6 md:grid-cols-3">
				{PILLAR_DETAILS.map((p) => {
					const Icon = p.icon;
					return (
						<li
							key={p.id}
							className="bg-surface-1 border-border hover:border-border-strong flex flex-col justify-between rounded-2xl border p-6 shadow-sm transition-all"
						>
							<div>
								<div className="flex items-center justify-between">
									<div className="bg-surface-2 text-fg rounded-xl p-3">
										<Icon size={24} weight="duotone" />
									</div>
									<Badge tone={p.tone}>{p.tag}</Badge>
								</div>

								<h3 className="text-fg mt-4 font-serif text-2xl">{p.name}</h3>
								<p className="text-fg-3 mt-0.5 font-mono text-xs font-medium tracking-wider uppercase">
									{p.role}
								</p>

								<p className="text-fg-2 mt-3 text-sm leading-relaxed">
									{p.line}
								</p>

								<ul className="border-border text-fg-3 mt-6 space-y-2 border-t pt-4 text-xs">
									{p.features.map((f) => (
										<li key={f} className="flex items-start gap-2">
											<span className="text-lumen mt-0.5 leading-none font-bold">
												•
											</span>
											<span>{f}</span>
										</li>
									))}
								</ul>
							</div>

							<div className="pt-6">
								<a
									href={p.link}
									target="_blank"
									rel="noopener noreferrer"
									className="text-fg-2 hover:text-fg hover:bg-surface-2 border-border inline-flex w-full items-center justify-between rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors"
								>
									<span>{p.linkLabel}</span>
									<ArrowUpRight size={14} weight="bold" />
								</a>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
