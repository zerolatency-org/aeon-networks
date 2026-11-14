import type { Metadata } from "next";
import { JobLoopList } from "@/components/marketing/job-loop-list";
import { StoryPlayer } from "@/components/marketing/story-player";
export const metadata: Metadata = {
	title: "How Aeon works",
	description:
		"Mint an agent, let it work while you are away, and keep your chats yours.",
};
export default function HowItWorksPage() {
	return (
		<main className="text-fg mx-auto max-w-[960px] px-6 py-16">
			<h1 className="text-fg font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
				How Aeon works
			</h1>
			<p className="text-fg-2 mt-4 max-w-[56ch] text-lg">
				Three short scenes, then the whole loop, step by step.
			</p>
			<div className="mt-10">
				<StoryPlayer />
			</div>
			<section className="mt-20" aria-labelledby="loop-title">
				<h2 id="loop-title" className="text-fg font-serif text-3xl md:text-4xl">
					The whole loop
				</h2>
				<p className="text-fg-2 mt-3 mb-6 max-w-[56ch]">
					Money moves only on chain. Content moves only as ciphertext.
				</p>
				<JobLoopList />
			</section>
		</main>
	);
}
