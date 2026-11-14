"use client";

import { cn } from "@/lib/utils";
import {
	phaseCaption,
	reached,
	shortHash,
	type VaultPhase,
	type VaultState,
} from "@/lib/vault";

const PHASES: { id: VaultPhase; label: string }[] = [
	{ id: "local", label: "Local" },
	{ id: "encrypting", label: "Sealing" },
	{ id: "uploading", label: "Uploading" },
	{ id: "uploaded", label: "0G Stored" },
	{ id: "anchored", label: "Anchored" },
	{ id: "deleted", label: "Key Dropped" },
];

export function VaultViz({ state }: { state: VaultState }) {
	const encrypting = reached(state, "encrypting");
	const uploading = reached(state, "uploading");
	const stored = reached(state, "uploaded");
	const anchored = reached(state, "anchored");
	const dead = !state.readable;

	return (
		<figure className="flex flex-col gap-6">
			{/* Phase Progress Bar */}
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
								"flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs transition-colors",
								isCurrent
									? p.id === "deleted"
										? "bg-coral/10 text-coral border-coral/30 border font-semibold"
										: "bg-lumen/15 text-lumen-fg border-lumen/40 border font-semibold"
									: isDone
										? "text-fg-2 font-medium"
										: "text-fg-3 opacity-60",
							)}
						>
							<span
								className={cn(
									"size-1.5 rounded-full",
									isCurrent
										? p.id === "deleted"
											? "bg-coral"
											: "bg-lumen"
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

			{/* Architectural SVG Visualization */}
			<svg
				viewBox="0 0 740 280"
				role="img"
				aria-label="Chats are sealed on this device, uploaded to 0G Storage, anchored on 0G Chain, and become unreadable when the key is dropped"
				className="h-auto w-full select-none"
			>
				<defs>
					<linearGradient id="dataBeam" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="var(--tide)" stopOpacity="0.2" />
						<stop offset="100%" stopColor="var(--tide)" stopOpacity="0.8" />
					</linearGradient>
				</defs>

				{/* ---------------- 1. THIS DEVICE ---------------- */}
				<g>
					<rect
						x="14"
						y="16"
						width="200"
						height="248"
						rx="14"
						fill="var(--surface-1)"
						stroke={
							dead
								? "var(--border)"
								: encrypting
									? "var(--lumen)"
									: "var(--border)"
						}
						strokeWidth="1.5"
					/>
					{/* Header */}
					<text
						x="30"
						y="42"
						fill="var(--text)"
						fontSize="13"
						fontWeight="600"
						fontFamily="var(--font-sans)"
					>
						This device
					</text>
					<text
						x="30"
						y="58"
						fill="var(--text-3)"
						fontSize="11"
						fontFamily="var(--font-mono)"
					>
						{dead
							? "KEY DESTROYED"
							: encrypting
								? "AES-256 SEALED"
								: "PLAINTEXT CHAT"}
					</text>

					{/* Chat message bubbles on device */}
					{[0, 1, 2, 3].map((i) => {
						const isEven = i % 2 === 0;
						const yPos = 74 + i * 36;
						return (
							<g key={i}>
								<rect
									x={isEven ? 30 : 64}
									y={yPos}
									width={isEven ? 130 : 136}
									height="28"
									rx="6"
									fill={
										dead
											? "var(--surface-2)"
											: encrypting
												? "var(--surface-3)"
												: isEven
													? "var(--surface-2)"
													: "var(--surface-3)"
									}
									stroke={dead ? "var(--coral)" : "none"}
									strokeWidth="1"
									strokeDasharray={dead ? "2 2" : undefined}
								/>
								<text
									x={isEven ? 40 : 74}
									y={yPos + 18}
									fill={
										dead
											? "var(--coral)"
											: encrypting
												? "var(--text-3)"
												: "var(--text-2)"
									}
									fontSize="10"
									fontFamily="var(--font-mono)"
								>
									{dead
										? "??:????:??:??"
										: encrypting
											? "0x8f2a...c4b1"
											: isEven
												? "Task payload"
												: "Agent response"}
								</text>
							</g>
						);
					})}

					{/* Key Status Pill */}
					<rect
						x="30"
						y="222"
						width="168"
						height="28"
						rx="6"
						fill={dead ? "var(--surface-2)" : "var(--surface-2)"}
						stroke={dead ? "var(--coral)" : "var(--border)"}
					/>
					<circle
						cx="44"
						cy="236"
						r="4"
						fill={dead ? "var(--coral)" : "var(--lumen)"}
					/>
					<text
						x="54"
						y="240"
						fill={dead ? "var(--coral)" : "var(--text-2)"}
						fontSize="11"
						fontWeight="500"
					>
						{dead ? "Client key dropped" : "Client secret held"}
					</text>
				</g>

				{/* Connecting Data Beam (Device -> 0G Storage) */}
				<g>
					<line
						x1="214"
						y1="140"
						x2="280"
						y2="140"
						stroke={uploading ? "var(--tide)" : "var(--border)"}
						strokeWidth="2"
						strokeDasharray={uploading ? "4 4" : undefined}
					/>
					{uploading && (
						<circle
							cx={214 + state.progress * 66}
							cy="140"
							r="4"
							fill="var(--tide)"
						/>
					)}
				</g>

				{/* ---------------- 2. 0G DECENTRALIZED STORAGE ---------------- */}
				<g>
					<rect
						x="280"
						y="16"
						width="260"
						height="248"
						rx="14"
						fill="var(--surface-1)"
						stroke={stored ? "var(--tide)" : "var(--border)"}
						strokeWidth="1.5"
					/>
					<text
						x="298"
						y="42"
						fill="var(--text)"
						fontSize="13"
						fontWeight="600"
						fontFamily="var(--font-sans)"
					>
						0G Storage Network
					</text>
					<text
						x="298"
						y="58"
						fill="var(--text-3)"
						fontSize="11"
						fontFamily="var(--font-mono)"
					>
						{stored ? "ERASURE-CODED SHARDS" : "INGESTION CLUSTER"}
					</text>

					{/* Storage Grid Nodes */}
					{[0, 1, 2, 3, 4, 5].map((i) => {
						const col = i % 3;
						const row = Math.floor(i / 3);
						const x = 304 + col * 74;
						const y = 78 + row * 64;
						return (
							<g key={i}>
								<rect
									x={x}
									y={y}
									width="62"
									height="50"
									rx="8"
									fill="var(--surface-2)"
									stroke={stored ? "var(--border-strong)" : "var(--border)"}
								/>
								<circle
									cx={x + 14}
									cy={y + 16}
									r="4"
									fill={
										stored
											? dead
												? "var(--coral)"
												: "var(--tide)"
											: "var(--surface-3)"
									}
								/>
								<text
									x={x + 24}
									y={y + 19}
									fill="var(--text-3)"
									fontSize="9"
									fontFamily="var(--font-mono)"
								>
									NODE {i + 1}
								</text>
								<text
									x={x + 8}
									y={y + 38}
									fill={
										dead
											? "var(--coral)"
											: stored
												? "var(--text-2)"
												: "var(--text-3)"
									}
									fontSize="9"
									fontFamily="var(--font-mono)"
								>
									{stored
										? dead
											? "SHARD OPAQUE"
											: `CHUNK #${i + 1}`
										: "STANDBY"}
								</text>
							</g>
						);
					})}

					{/* 0G Storage Root Status */}
					<rect
						x="298"
						y="218"
						width="224"
						height="32"
						rx="6"
						fill="var(--surface-2)"
						stroke="var(--border)"
					/>
					<text
						x="310"
						y="238"
						fill={stored ? "var(--text-2)" : "var(--text-3)"}
						fontSize="11"
						fontFamily="var(--font-mono)"
					>
						{state.root ? `Root: ${state.root}` : "Pending chunk dispersion"}
					</text>
				</g>

				{/* Connecting Data Beam (0G Storage -> 0G Chain) */}
				<line
					x1="540"
					y1="140"
					x2="590"
					y2="140"
					stroke={anchored ? "var(--lumen)" : "var(--border)"}
					strokeWidth="2"
					strokeDasharray={anchored ? undefined : "4 4"}
				/>

				{/* ---------------- 3. 0G CHAIN ANCHOR ---------------- */}
				<g>
					<rect
						x="590"
						y="16"
						width="136"
						height="248"
						rx="14"
						fill="var(--surface-1)"
						stroke={anchored ? "var(--lumen)" : "var(--border)"}
						strokeWidth="1.5"
					/>
					<text
						x="604"
						y="42"
						fill="var(--text)"
						fontSize="13"
						fontWeight="600"
						fontFamily="var(--font-sans)"
					>
						0G Chain
					</text>
					<text
						x="604"
						y="58"
						fill="var(--text-3)"
						fontSize="11"
						fontFamily="var(--font-mono)"
					>
						CONSENSUS
					</text>

					{/* Merkle Root Fingerprint Block */}
					<rect
						x="604"
						y="78"
						width="108"
						height="100"
						rx="10"
						fill="var(--surface-2)"
						stroke={anchored ? "var(--lumen)" : "var(--border)"}
						strokeWidth={anchored ? "1.5" : "1"}
					/>

					<circle
						cx="658"
						cy="112"
						r="16"
						fill={anchored ? "var(--lumen)" : "var(--surface-3)"}
						fillOpacity={anchored ? "0.2" : "1"}
						stroke={anchored ? "var(--lumen)" : "none"}
					/>
					<text
						x="658"
						y="116"
						textAnchor="middle"
						fill={anchored ? "var(--lumen)" : "var(--text-3)"}
						fontSize="11"
						fontWeight="700"
						fontFamily="var(--font-mono)"
					>
						0G
					</text>

					<text
						x="658"
						y="148"
						textAnchor="middle"
						fill="var(--text-2)"
						fontSize="10"
						fontWeight="500"
					>
						{anchored ? "Merkle Root" : "Waiting Tx"}
					</text>

					<text
						x="658"
						y="164"
						textAnchor="middle"
						fill={anchored ? "var(--text-3)" : "var(--text-3)"}
						fontSize="9"
						fontFamily="var(--font-mono)"
					>
						{anchored ? "Galileo 16602" : "—"}
					</text>

					{/* Anchored Tx Stamp */}
					<rect
						x="604"
						y="190"
						width="108"
						height="60"
						rx="8"
						fill={anchored ? "var(--surface-2)" : "var(--surface-2)"}
						stroke={anchored ? "var(--border-strong)" : "var(--border)"}
					/>
					<text
						x="612"
						y="212"
						fill="var(--text-3)"
						fontSize="9"
						fontFamily="var(--font-mono)"
					>
						TX HASH
					</text>
					<text
						x="612"
						y="230"
						fill={anchored ? "var(--lumen-fg)" : "var(--text-3)"}
						fontSize="10"
						fontWeight="600"
						fontFamily="var(--font-mono)"
					>
						{anchored && state.tx ? shortHash(state.tx) : "Pending..."}
					</text>
				</g>
			</svg>

			{/* Phase Caption & Security Guarantee */}
			<figcaption className="bg-surface-2/60 border-border rounded-xl border p-4 text-center">
				<p className="text-fg text-sm font-medium">{phaseCaption(state)}</p>
				<p className="text-fg-3 mt-1 text-xs">
					{dead
						? "Cryptographic guarantee: Once the client secret is cleared, encrypted shards on 0G Storage cannot be decoded by anyone."
						: "Sealed client-side with AES-256-GCM. Stored on 0G Storage nodes. Cryptographically anchored on 0G Galileo testnet."}
				</p>
			</figcaption>
		</figure>
	);
}
