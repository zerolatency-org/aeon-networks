"use client";
import { phaseCaption, reached, shortHash, type VaultState } from "@/lib/vault";
export function VaultViz({ state }: { state: VaultState }) {
	const stored = reached(state, "uploaded");
	const anchored = reached(state, "anchored");
	const dead = !state.readable;
	return (
		<figure>
			<svg
				viewBox="0 0 720 260"
				role="img"
				aria-label="Chats are sealed on this device, uploaded to 0G Storage, anchored on 0G Chain, and become unreadable when the key is dropped"
				className="h-auto w-full"
			>
				<rect
					x="16"
					y="20"
					width="190"
					height="220"
					rx="16"
					fill="var(--surface-2)"
					stroke="var(--border)"
				/>
				<rect
					x="290"
					y="20"
					width="270"
					height="220"
					rx="16"
					fill="var(--surface-2)"
					stroke="var(--border)"
				/>
				<rect
					x="584"
					y="20"
					width="124"
					height="220"
					rx="16"
					fill="var(--surface-2)"
					stroke="var(--border)"
				/>
				<text x="32" y="44" fill="var(--text-3)" fontSize="12">
					This device
				</text>
				<text x="306" y="44" fill="var(--text-3)" fontSize="12">
					0G Storage
				</text>
				<text x="600" y="44" fill="var(--text-3)" fontSize="12">
					0G Chain
				</text>
				{[0, 1, 2, 3].map((i) => (
					<rect
						key={i}
						x={36 + (i % 2) * 80}
						y={64 + Math.floor(i / 2) * 54}
						width="64"
						height="44"
						rx="8"
						fill="var(--surface-3)"
						opacity={stored ? 0.35 : 1}
					/>
				))}
				<line
					x1="206"
					y1="130"
					x2="290"
					y2="130"
					stroke="var(--tide)"
					strokeDasharray="4 6"
				/>
				<text x="360" y="140" fill="var(--text-2)" fontSize="14">
					{stored ? "encrypted archive" : "sealing…"}
				</text>
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<circle
						key={i}
						cx={340 + (i % 3) * 90}
						cy={90 + Math.floor(i / 3) * 100}
						r="12"
						fill={stored ? "var(--tide)" : "var(--surface-3)"}
					/>
				))}
				<rect
					x="610"
					y="96"
					width="72"
					height="68"
					rx="10"
					fill={anchored && !dead ? "var(--lumen)" : "none"}
					fillOpacity=".18"
					stroke={
						dead
							? "var(--coral)"
							: anchored
								? "var(--lumen)"
								: "var(--border-strong)"
					}
					strokeDasharray={anchored && !dead ? undefined : "5 5"}
				/>
				{anchored ? (
					<text
						x="646"
						y="190"
						textAnchor="middle"
						fill={dead ? "var(--coral)" : "var(--text-2)"}
						fontSize="12"
					>
						{dead ? "Unreadable" : `Anchored ${shortHash(state.tx ?? "")}`}
					</text>
				) : null}
			</svg>
			<figcaption className="text-fg-2 mt-4 min-h-7 text-center">
				{phaseCaption(state)}
			</figcaption>
		</figure>
	);
}
