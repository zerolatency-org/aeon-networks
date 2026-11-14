"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useVaultDemo } from "./use-vault-demo";
import { VaultViz } from "./vault-viz";

export function VaultSection() {
	const ref = useRef<HTMLElement>(null);
	const [active, setActive] = useState(false);
	const state = useVaultDemo(active);

	useEffect(() => {
		const o = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting));
		if (ref.current) o.observe(ref.current);
		return () => o.disconnect();
	}, []);

	return (
		<MotionConfig reducedMotion="user">
			<section
				ref={ref}
				className="mx-auto max-w-[1280px] px-6 py-20"
				aria-labelledby="vault-title"
			>
				<div className="flex flex-col gap-3">
					<span className="text-tide font-mono text-xs font-semibold tracking-wider uppercase">
						Decentralized Zero-Knowledge Storage
					</span>
					<h2
						id="vault-title"
						className="text-fg font-serif text-4xl md:text-5xl"
					>
						Your chats stay yours
					</h2>
					<p className="text-fg-2 mt-1 max-w-[56ch] text-lg leading-relaxed">
						Chats are sealed on your device, stored across 0G decentralized
						nodes, and anchored on chain. Drop your local key and the archive is
						mathematically unreadable forever.
					</p>
				</div>

				<div className="bg-surface-1 border-border mt-8 rounded-2xl border p-6 shadow-sm md:p-8">
					<VaultViz state={state} />
				</div>
			</section>
		</MotionConfig>
	);
}
