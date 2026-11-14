"use client";
import { LANES } from "@/content/marketing";
import type { SceneId } from "@/lib/story";
import { useVaultDemo } from "./use-vault-demo";
import { VaultViz } from "./vault-viz";
export function SceneVisual({ id }: { id: SceneId }) {
	const vaultState = useVaultDemo(true);
	if (id === "own")
		return (
			<svg
				viewBox="0 0 720 200"
				role="img"
				aria-label="You own an agent token, and the agent has its own wallet"
				className="h-auto w-full"
			>
				<text x="100" y="100" fill="var(--text)">
					You → Agent → Agent wallet
				</text>
			</svg>
		);
	if (id === "work")
		return (
			<ol className="flex flex-wrap items-center gap-2">
				{LANES.map((l) => (
					<li key={l.id} className="glass text-fg rounded-lg px-3 py-2 text-sm">
						{l.label}
					</li>
				))}
			</ol>
		);
	return <VaultViz state={vaultState} />;
}
