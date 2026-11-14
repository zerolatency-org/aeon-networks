"use client";
import { useEffect, useRef, useState } from "react";
import { JOB_STEPS, LANES } from "@/content/marketing";
import {
	activeStep,
	laneColumn,
	movesNote,
	pinLength,
	type StepState,
	stepState,
} from "@/lib/job-scene";

const CHIP: Record<StepState, string> = {
	done: "border-border bg-surface-1 text-fg-2",
	active: "border-lumen bg-surface-2 text-fg",
	waiting: "border-border/50 text-fg-3",
};
export function JobScene() {
	const root = useRef<HTMLElement>(null);
	const [pinned, setPinned] = useState(false);
	const [step, setStep] = useState(0);
	useEffect(() => {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let kill: (() => void) | undefined;
		let cancelled = false;
		void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
			([{ gsap }, { ScrollTrigger }]) => {
				if (cancelled) return;
				gsap.registerPlugin(ScrollTrigger);
				const t = ScrollTrigger.create({
					trigger: root.current,
					start: "top top",
					end: pinLength(),
					pin: true,
					onUpdate: (s) => setStep(activeStep(s.progress)),
				});
				setPinned(true);
				kill = () => t.kill();
			},
		);
		return () => {
			cancelled = true;
			kill?.();
		};
	}, []);
	const lit = pinned ? step : JOB_STEPS.length;
	const current = JOB_STEPS[Math.min(step, JOB_STEPS.length - 1)];
	return (
		<section
			ref={root}
			className="mx-auto flex min-h-screen max-w-[1280px] flex-col justify-center px-6 py-16"
			aria-labelledby="job-title"
		>
			<h2 id="job-title" className="text-fg font-serif text-4xl md:text-5xl">
				How a job works
			</h2>
			<p className="text-fg-2 mt-3 max-w-[56ch] text-lg">
				Money moves only on chain. Content moves only as ciphertext.
			</p>
			<ol className="mt-8 grid gap-2 md:grid-cols-5">
				{LANES.map((l) => (
					<li
						key={l.id}
						className="border-border text-fg-3 hidden border-b pb-2 text-sm md:block"
						style={{ gridColumn: laneColumn(l.id) }}
					>
						{l.label}
					</li>
				))}
				{JOB_STEPS.map((s, i) => (
					<li
						key={s.id}
						aria-current={pinned && i === step ? "step" : undefined}
						className={`rounded-lg border px-3 py-2 text-sm transition-opacity md:[grid-column:var(--c)] ${CHIP[stepState(i, lit)]}`}
						style={
							{
								gridRow: s.n + 1,
								"--c": laneColumn(s.lane) as number,
							} as React.CSSProperties
						}
					>
						<span className="num text-fg-3">{s.n}</span> {s.title}
						<span className="text-fg-3 ml-2 md:hidden">
							{LANES.find((l) => l.id === s.lane)?.label}
						</span>
					</li>
				))}
			</ol>
			<div
				className="glass mt-8 min-h-[88px] rounded-xl p-5"
				aria-live="polite"
			>
				<p className="text-fg">
					<span className="num text-fg-3">{current?.n}. </span>
					{current?.line}
				</p>
				<p className="text-fg-3 mt-1 text-sm">
					{current && movesNote(current.moves)}
				</p>
			</div>
		</section>
	);
}
