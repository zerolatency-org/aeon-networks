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
				<h2
					id="vault-title"
					className="text-fg font-serif text-4xl md:text-5xl"
				>
					Your chats stay yours
				</h2>
				<p className="text-fg-2 mt-3 max-w-[56ch] text-lg">
					Chats are sealed on your device, stored on 0G and anchored on chain.
					Drop the key and they are gone for good. This is a scripted demo.
				</p>
				<div className="glass mt-8 rounded-xl p-6">
					<VaultViz state={state} />
				</div>
			</section>
		</MotionConfig>
	);
}
