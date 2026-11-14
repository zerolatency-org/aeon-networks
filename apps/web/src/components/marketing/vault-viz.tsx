"use client";

import {
	Coins,
	Database,
	DeviceMobile,
	Key,
	LockKey,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
	phaseCaption,
	reached,
	shortHash,
	type VaultPhase,
	type VaultState,
} from "@/lib/vault";

const PHASES: { id: VaultPhase; label: string }[] = [
	{ id: "local", label: "1. Local Chat" },
	{ id: "encrypting", label: "2. Sealed" },
	{ id: "uploading", label: "3. Dispersing" },
	{ id: "uploaded", label: "4. 0G Storage" },
	{ id: "anchored", label: "5. On Chain" },
	{ id: "deleted", label: "6. Key Dropped" },
];

export function VaultViz({ state }: { state: VaultState }) {
	const encrypting = reached(state, "encrypting");
	const uploading = reached(state, "uploading");
	const stored = reached(state, "uploaded");
	const anchored = reached(state, "anchored");
	const dead = !state.readable;

	return (
		<figure className="flex flex-col gap-6">
			{/* Phase Progress Scrubber Bar */}
			<div className="border-border flex flex-wrap items-center justify-between gap-2 border-b pb-4">
				{PHASES.map((p) => {
					const isCurrent =
						state.phase === p.id ||
						(p.id === "anchored" && state.phase === "anchoring");
					const isDone = reached(state, p.id);
					return (
						<div
							key={p.id}
							className={cn(
								"flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs transition-all duration-300",
								isCurrent
									? p.id === "deleted"
										? "bg-coral/10 text-coral border-coral/40 border font-semibold"
										: "bg-lumen/15 text-lumen-fg border-lumen/40 border font-semibold shadow-sm"
									: isDone
										? "text-fg-2 font-medium"
										: "text-fg-3 opacity-60",
							)}
						>
							<span
								className={cn(
									"size-1.5 rounded-full transition-colors",
									isCurrent
										? p.id === "deleted"
											? "bg-coral motion-safe:animate-pulse"
											: "bg-lumen motion-safe:animate-pulse"
										: isDone
											? "bg-moss"
											: "bg-surface-3",
								)}
							/>
							<span>{p.label}</span>
						</div>
					);
				})}
			</div>

			{/* 3-Step Flow Pipeline: Device -> 0G Storage -> 0G Chain */}
			<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
				{/* ---------------- 1. THIS DEVICE ---------------- */}
				<div
					className={cn(
						"bg-surface-2/40 border-border flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-300",
						dead
							? "border-coral/40 bg-coral/5"
							: encrypting
								? "border-lumen/40 bg-surface-2/70"
								: "",
					)}
				>
					<div>
						{/* Card Header */}
						<div className="border-border/50 flex items-center justify-between gap-2 border-b pb-3">
							<div className="flex items-center gap-2">
								<div
									className={cn(
										"rounded-lg p-1.5 transition-colors",
										dead
											? "bg-coral/15 text-coral"
											: encrypting
												? "bg-lumen text-lumen-ink"
												: "bg-surface-3 text-fg-2",
									)}
								>
									{dead ? (
										<LockKey size={18} weight="bold" />
									) : (
										<DeviceMobile size={18} weight="duotone" />
									)}
								</div>
								<div>
									<h4 className="text-fg font-serif text-base leading-tight font-semibold">
										This Device
									</h4>
									<p className="text-fg-3 text-[11px]">Client Key & Memory</p>
								</div>
							</div>
							<Badge
								tone={dead ? "danger" : encrypting ? "live" : "neutral"}
								className="text-[10px]"
							>
								{dead
									? "Key Destroyed"
									: encrypting
										? "AES-256 Sealed"
										: "Plaintext"}
							</Badge>
						</div>

						{/* Chat message bubbles preview */}
						<div className="mt-3.5 space-y-2">
							<div className="bg-surface-1 border-border/60 rounded-lg border p-2.5 shadow-xs">
								<p className="text-fg-3 text-[10px] font-medium tracking-wider uppercase">
									User Task
								</p>
								<p
									className={cn(
										"mt-0.5 truncate font-mono text-xs transition-colors",
										dead ? "text-coral" : encrypting ? "text-fg-3" : "text-fg",
									)}
								>
									{dead
										? "•••• •••• •••• ••••"
										: encrypting
											? "0x8f2a…c4b1 [Ciphertext]"
											: "Audit smart contract on 0G"}
								</p>
							</div>

							<div className="bg-surface-1/70 border-border/60 rounded-lg border p-2.5 shadow-xs">
								<p className="text-fg-3 text-[10px] font-medium tracking-wider uppercase">
									Agent Output
								</p>
								<p
									className={cn(
										"mt-0.5 truncate font-mono text-xs transition-colors",
										dead
											? "text-coral"
											: encrypting
												? "text-fg-3"
												: "text-fg-2",
									)}
								>
									{dead
										? "•••• •••• •••• ••••"
										: encrypting
											? "0x3a91…d8e2 [Ciphertext]"
											: "0 critical vulnerabilities found"}
								</p>
							</div>
						</div>
					</div>

					{/* Key Status Pill Footer */}
					<div
						className={cn(
							"mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
							dead
								? "border-coral/40 bg-coral/10 text-coral font-medium"
								: "border-border bg-surface-1 text-fg-2",
						)}
					>
						<span className="flex items-center gap-1.5">
							<Key size={14} weight={dead ? "bold" : "regular"} />
							<span>{dead ? "Client Key Cleared" : "Client Secret Held"}</span>
						</span>
						<span className="font-mono text-[10px]">
							{dead ? "Unrecoverable" : "Local Only"}
						</span>
					</div>
				</div>

				{/* ---------------- 2. 0G STORAGE NETWORK ---------------- */}
				<div
					className={cn(
						"bg-surface-2/40 border-border flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-300",
						stored ? "border-tide/40 bg-surface-2/70" : "",
					)}
				>
					<div>
						{/* Card Header */}
						<div className="border-border/50 flex items-center justify-between gap-2 border-b pb-3">
							<div className="flex items-center gap-2">
								<div
									className={cn(
										"rounded-lg p-1.5 transition-colors",
										stored
											? "bg-tide text-surface-1 font-bold"
											: "bg-surface-3 text-fg-2",
									)}
								>
									<Database size={18} weight="duotone" />
								</div>
								<div>
									<h4 className="text-fg font-serif text-base leading-tight font-semibold">
										0G Storage
									</h4>
									<p className="text-fg-3 text-[11px]">
										Decentralized DA Layer
									</p>
								</div>
							</div>
							<Badge
								tone={stored ? "storage" : uploading ? "waiting" : "neutral"}
								className="text-[10px]"
							>
								{stored
									? "6 Shards Stored"
									: uploading
										? `Dispersing ${Math.round(state.progress * 100)}%`
										: "Standby"}
							</Badge>
						</div>

						{/* 6 Shard Dispersion Preview Grid */}
						<div className="mt-3.5 grid grid-cols-3 gap-2">
							{[1, 2, 3, 4, 5, 6].map((idx) => (
								<div
									key={idx}
									className={cn(
										"rounded-lg border p-2 text-center transition-colors",
										stored
											? dead
												? "border-coral/30 bg-coral/5 text-coral"
												: "border-tide/30 bg-surface-1 text-tide"
											: "border-border/60 bg-surface-1/40 text-fg-3",
									)}
								>
									<p className="font-mono text-[10px] font-medium">
										Node {idx}
									</p>
									<p className="mt-0.5 font-mono text-[9px] opacity-80">
										{stored ? (dead ? "Opaque" : "Chunk OK") : "Waiting"}
									</p>
								</div>
							))}
						</div>
					</div>

					{/* Merkle Root Hash Box (Truncated with full CSS overflow protection) */}
					<div className="bg-surface-1 border-border mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
						<span className="text-fg-3 shrink-0 text-[11px] font-medium">
							Root Hash:
						</span>
						<span className="text-fg ml-2 truncate font-mono text-[11px]">
							{state.root ? shortHash(state.root) : "Pending dispersion"}
						</span>
					</div>
				</div>

				{/* ---------------- 3. 0G CHAIN ANCHOR ---------------- */}
				<div
					className={cn(
						"bg-surface-2/40 border-border flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-300",
						anchored ? "border-lumen/40 bg-surface-2/70" : "",
					)}
				>
					<div>
						{/* Card Header */}
						<div className="border-border/50 flex items-center justify-between gap-2 border-b pb-3">
							<div className="flex items-center gap-2">
								<div
									className={cn(
										"rounded-lg p-1.5 transition-colors",
										anchored
											? "bg-lumen text-lumen-ink"
											: "bg-surface-3 text-fg-2",
									)}
								>
									<Coins size={18} weight="duotone" />
								</div>
								<div>
									<h4 className="text-fg font-serif text-base leading-tight font-semibold">
										0G Chain
									</h4>
									<p className="text-fg-3 text-[11px]">
										Consensus & Settlement
									</p>
								</div>
							</div>
							<Badge
								tone={anchored ? "live" : "neutral"}
								className="text-[10px]"
							>
								{anchored ? "Galileo Anchored" : "Waiting Tx"}
							</Badge>
						</div>

						{/* Proof Consensus Certificate Card */}
						<div className="bg-surface-1 border-border/70 mt-3.5 rounded-lg border p-3">
							<div className="flex items-center justify-between gap-2">
								<span className="text-fg text-xs font-semibold">
									Archive Proof
								</span>
								<span className="text-lumen-fg bg-lumen/10 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
									0G Testnet
								</span>
							</div>
							<div className="text-fg-3 mt-2 space-y-1 text-[11px]">
								<div className="flex justify-between">
									<span>Chain ID:</span>
									<span className="text-fg-2 font-mono">16602 (Galileo)</span>
								</div>
								<div className="flex justify-between">
									<span>Integrity:</span>
									<span className="text-moss font-mono">Merkle Verified</span>
								</div>
							</div>
						</div>
					</div>

					{/* Tx Hash Box (Clean CSS truncate - NEVER overflows!) */}
					<div className="bg-surface-1 border-border mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
						<span className="text-fg-3 shrink-0 text-[11px] font-medium">
							Tx Hash:
						</span>
						<span className="text-lumen-fg ml-2 truncate font-mono text-[11px] font-semibold">
							{anchored && state.tx ? shortHash(state.tx) : "Pending block…"}
						</span>
					</div>
				</div>
			</div>

			{/* Phase Caption & Cryptographic Guarantee Banner */}
			<figcaption className="bg-surface-1 border-border rounded-xl border p-4 text-center shadow-xs">
				<p className="text-fg font-serif text-base font-semibold">
					{phaseCaption(state)}
				</p>
				<p className="text-fg-3 mt-1 text-xs">
					{dead
						? "Cryptographic guarantee: Once the client secret is cleared, encrypted shards on 0G Storage cannot be decoded by anyone."
						: "Sealed client-side with AES-256-GCM. Dispersed across 0G Storage nodes. Anchored on 0G Chain."}
				</p>
			</figcaption>
		</figure>
	);
}
