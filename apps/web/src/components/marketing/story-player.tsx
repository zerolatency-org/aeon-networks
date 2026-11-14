"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { LINKS, MINT_HREF } from "@/content/marketing";
import {
	isFirst,
	isLast,
	keyAction,
	progressLabel,
	SCENES,
	storyStep,
} from "@/lib/story";
import { SceneVisual } from "./story-visuals";
export function StoryPlayer({
	captureKeys = true,
	mintHref = MINT_HREF,
}: {
	captureKeys?: boolean;
	mintHref?: string;
}) {
	const [index, move] = useReducer(storyStep, 0);
	useEffect(() => {
		if (!captureKeys) return;
		const f = (e: KeyboardEvent) => {
			const a = keyAction(e.key);
			if (a) move(a);
		};
		addEventListener("keydown", f);
		return () => removeEventListener("keydown", f);
	}, [captureKeys]);
	const scene = SCENES[index] ?? SCENES[0];
	return (
		<MotionConfig reducedMotion="user">
			<section
				className="glass rounded-xl p-6 md:p-10"
				aria-labelledby="story-title"
			>
				<p className="num text-fg-3 text-sm" aria-live="polite">
					{progressLabel(index)}
				</p>
				<AnimatePresence mode="wait">
					<motion.div
						key={scene.id}
						initial={false}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<h2
							id="story-title"
							className="text-fg mt-2 font-serif text-3xl md:text-4xl"
						>
							{scene.title}
						</h2>
						<p className="text-fg-2 mt-3 max-w-[56ch] text-lg">{scene.body}</p>
						<div className="mt-8 min-h-[280px]">
							<SceneVisual id={scene.id} />
						</div>
					</motion.div>
				</AnimatePresence>
				<div className="mt-8 flex flex-wrap items-center justify-between gap-4">
					<Button
						variant="ghost"
						disabled={isFirst(index)}
						onClick={() => move("back")}
					>
						Back
					</Button>
					{isLast(index) ? (
						<div className="flex flex-wrap items-center gap-5">
							<a
								href={LINKS.faucet}
								target="_blank"
								rel="noopener noreferrer"
								className="text-fg-2 underline"
							>
								Get testnet 0G from the faucet
							</a>
							<Link
								href={mintHref}
								className="bg-lumen text-lumen-ink inline-flex h-11 items-center rounded-lg px-5 font-medium"
							>
								Mint your first agent
							</Link>
						</div>
					) : (
						<Button variant="lumen" onClick={() => move("next")}>
							Next
						</Button>
					)}
				</div>
			</section>
		</MotionConfig>
	);
}
