"use client";

import {
	CaretLeft,
	CaretRight,
	Check,
	CheckCircle,
	Coins,
	Cpu,
	type IconProps,
	LockKey,
	Pause,
	Play,
	ShieldCheck,
	User,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { JOB_STEPS, LANES, type LaneId } from "@/content/marketing";
import { movesNote, stepState } from "@/lib/job-scene";
import { cn } from "@/lib/utils";

const LANE_ICONS: Record<LaneId, React.ComponentType<IconProps>> = {
	owner: User,
	aeon: ShieldCheck,
	chain: Coins,
	provider: Cpu,
	verifier: CheckCircle,
};

const LANE_SPECS: Record<
	LaneId,
	{
		roleBadge: string;
		techStack: string;
		guaranteeTitle: string;
		guaranteeDesc: string;
		protocolFeature: string;
	}
> = {
	owner: {
		roleBadge: "Client Node",
		techStack: "0G DA · AES-256",
		guaranteeTitle: "Zero-Knowledge Custody",
		guaranteeDesc:
			"Client-side key derivation. Plaintext tasks and private keys never leave your device.",
		protocolFeature: "Encrypted Storage",
	},
	aeon: {
		roleBadge: "Relay Protocol",
		techStack: "P2P · Discovery",
		guaranteeTitle: "Capability Matching",
		guaranteeDesc:
			"Matches task requirements to registered provider agents without decrypting payload.",
		protocolFeature: "Blind Relay",
	},
	chain: {
		roleBadge: "0G Consensus",
		techStack: "Galileo EVM · Escrow",
		guaranteeTitle: "Trustless Settlement",
		guaranteeDesc:
			"Smart contract locks funds upfront and triggers instant release upon verification.",
		protocolFeature: "Programmable Escrow",
	},
	provider: {
		roleBadge: "0G Compute",
		techStack: "TEE Enclave · Inference",
		guaranteeTitle: "Confidential Execution",
		guaranteeDesc:
			"Autonomous worker nodes execute tasks inside isolated sandboxes on 0G Compute.",
		protocolFeature: "Verifiable Compute",
	},
	verifier: {
		roleBadge: "Consensus Test",
		techStack: "ZK Assertion · SLA",
		guaranteeTitle: "Deterministic Verification",
		guaranteeDesc:
			"Autonomous test runner checks computation correctness and SLA output before payout.",
		protocolFeature: "Consensus Verification",
	},
};

const MOVE_CONFIG = {
	money: {
		label: "0G Escrow / Payout",
		badgeTone: "live" as const,
		icon: Coins,
		border: "border-lumen",
		bg: "bg-lumen/10",
		text: "text-lumen-fg",
	},
	content: {
		label: "Ciphertext Sealed",
		badgeTone: "storage" as const,
		icon: LockKey,
		border: "border-tide",
		bg: "bg-tide/10",
		text: "text-tide",
	},
	none: {
		label: "Verifiable Execution",
		badgeTone: "neutral" as const,
		icon: Cpu,
		border: "border-border",
		bg: "bg-surface-2",
		text: "text-fg-3",
	},
};

export function JobScene() {
	const sectionRef = useRef<HTMLElement>(null);
	const [activeStepIndex, setActiveStepIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(true);
	const [isInView, setIsInView] = useState(false);

	// Start auto-play automatically when section appears on screen
	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsInView(true);
					setIsPlaying(true);
				} else {
					setIsInView(false);
				}
			},
			{ threshold: 0.15 },
		);

		if (sectionRef.current) {
			observer.observe(sectionRef.current);
		}

		return () => observer.disconnect();
	}, []);

	// Auto-advance step timer when playing and in viewport
	useEffect(() => {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setIsPlaying(false);
			return;
		}

		if (!isPlaying || !isInView) return;

		const timer = setInterval(() => {
			setActiveStepIndex((prev) => (prev + 1) % JOB_STEPS.length);
		}, 1400);

		return () => clearInterval(timer);
	}, [isPlaying, isInView]);

	// Smooth scroll scrubber: scrolling down advances active step
	useEffect(() => {
		const handleScroll = () => {
			if (!sectionRef.current) return;
			const rect = sectionRef.current.getBoundingClientRect();
			const windowH = window.innerHeight;

			// Check if section is currently active in viewport
			if (rect.top <= windowH * 0.5 && rect.bottom >= windowH * 0.2) {
				const totalRange = rect.height + windowH * 0.3;
				const currentPos = windowH * 0.5 - rect.top;
				const p = Math.max(0, Math.min(1, currentPos / totalRange));
				const stepIdx = Math.min(
					JOB_STEPS.length - 1,
					Math.floor(p * JOB_STEPS.length),
				);
				setActiveStepIndex(stepIdx);
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const current = JOB_STEPS[activeStepIndex] ?? JOB_STEPS[0];
	const currentLane = LANES.find((l) => l.id === current.lane);
	const moveConfig = MOVE_CONFIG[current.moves];

	const handlePrev = () => {
		setIsPlaying(false);
		setActiveStepIndex((prev) =>
			prev === 0 ? JOB_STEPS.length - 1 : prev - 1,
		);
	};

	const handleNext = () => {
		setIsPlaying(false);
		setActiveStepIndex((prev) => (prev + 1) % JOB_STEPS.length);
	};

	const handleSelectStep = (index: number) => {
		setIsPlaying(false);
		setActiveStepIndex(index);
	};

	return (
		<section
			ref={sectionRef}
			id="workflow-section"
			className="mx-auto max-w-[1280px] px-4 py-16 md:px-6 md:py-24"
			aria-labelledby="job-title"
		>
			{/* Section Header */}
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-lumen-fg font-mono text-xs font-semibold tracking-wider uppercase">
							Decentralized Workflow
						</span>
						<span className="text-fg-3 text-xs">·</span>
						<span className="text-fg-2 font-mono text-xs">
							0G Chain · Storage · Compute
						</span>
					</div>
					<h2
						id="job-title"
						className="text-fg font-serif text-3xl md:text-5xl"
					>
						How a job works
					</h2>
					<p className="text-fg-2 mt-2 max-w-[56ch] text-base md:text-lg">
						Money moves only on chain. Content moves only as ciphertext. Follow
						an autonomous agent execution across 5 decentralized actors.
					</p>
				</div>

				{/* Progress Scrubber Bar & Controls */}
				<div className="flex flex-wrap items-center gap-3">
					{/* Active Step Counter Meter */}
					<div className="bg-surface-1 border-border flex items-center gap-3 rounded-xl border px-3 py-1.5 shadow-sm">
						<span className="text-fg font-mono text-xs font-semibold">
							Step {current.n < 10 ? `0${current.n}` : current.n} / 10
						</span>
						<div className="bg-surface-2 h-1.5 w-24 overflow-hidden rounded-full">
							<div
								className="bg-lumen h-full rounded-full transition-all duration-300"
								style={{
									width: `${((activeStepIndex + 1) / JOB_STEPS.length) * 100}%`,
								}}
							/>
						</div>
					</div>

					{/* Play / Pause / Navigation Controls */}
					<div className="bg-surface-1 border-border flex items-center gap-1 rounded-xl border p-1 shadow-sm">
						<button
							type="button"
							onClick={handlePrev}
							aria-label="Previous step"
							className="text-fg-2 hover:text-fg hover:bg-surface-2 rounded-lg p-1.5 transition-colors"
						>
							<CaretLeft size={16} weight="bold" />
						</button>
						<button
							type="button"
							onClick={() => setIsPlaying((p) => !p)}
							aria-label={
								isPlaying
									? "Pause workflow animation"
									: "Play workflow animation"
							}
							className="bg-surface-2 text-fg hover:bg-surface-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
						>
							{isPlaying ? (
								<>
									<Pause size={13} weight="fill" />
									<span>Pause</span>
								</>
							) : (
								<>
									<Play size={13} weight="fill" />
									<span>Auto</span>
								</>
							)}
						</button>
						<button
							type="button"
							onClick={handleNext}
							aria-label="Next step"
							className="text-fg-2 hover:text-fg hover:bg-surface-2 rounded-lg p-1.5 transition-colors"
						>
							<CaretRight size={16} weight="bold" />
						</button>
					</div>
				</div>
			</div>

			{/* Step Sequence Pills (Quick Navigation) */}
			<div
				className="mt-6 flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1"
				role="tablist"
				aria-label="Workflow step selector"
			>
				{JOB_STEPS.map((s, idx) => {
					const isActive = idx === activeStepIndex;
					const isPast = idx < activeStepIndex;
					return (
						<button
							key={s.id}
							type="button"
							role="tab"
							aria-selected={isActive}
							onClick={() => handleSelectStep(idx)}
							className={cn(
								"flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all",
								isActive
									? "bg-lumen text-lumen-ink border-lumen font-medium shadow-sm"
									: isPast
										? "bg-surface-1 text-fg border-border hover:bg-surface-2"
										: "bg-surface-1/50 text-fg-3 border-border/50 hover:bg-surface-2 hover:text-fg-2",
							)}
						>
							<span className="font-mono">{s.n < 10 ? `0${s.n}` : s.n}</span>
							<span>{s.title}</span>
						</button>
					);
				})}
			</div>

			{/* Main Architectural 5-Actor Grid (Filled, Clean & Minimal UI) */}
			<div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
				{LANES.map((lane) => {
					const Icon = LANE_ICONS[lane.id];
					const spec = LANE_SPECS[lane.id];
					const laneSteps = JOB_STEPS.filter((s) => s.lane === lane.id);
					const isLaneActive = current.lane === lane.id;

					return (
						<div
							key={lane.id}
							className={cn(
								"bg-surface-1 border-border flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-300",
								isLaneActive
									? "border-lumen ring-lumen/40 bg-surface-1/90 ring-1"
									: "hover:border-border-strong",
							)}
						>
							{/* Column Header: Actor Identity */}
							<div>
								<div className="border-border/60 border-b pb-3">
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"rounded-lg p-1.5 transition-colors",
													isLaneActive
														? "bg-lumen text-lumen-ink"
														: "bg-surface-2 text-fg-2",
												)}
											>
												<Icon size={16} weight="duotone" />
											</div>
											<h3 className="text-fg font-sans text-sm leading-tight font-semibold">
												{lane.label}
											</h3>
										</div>
										<Badge
											tone={isLaneActive ? "live" : "neutral"}
											className="font-mono text-[10px] tracking-wider"
										>
											{spec.roleBadge}
										</Badge>
									</div>
									<p className="text-fg-3 mt-1.5 text-xs leading-normal">
										{lane.note}
									</p>
								</div>

								{/* Steps Pipeline within this Actor */}
								<div className="mt-3.5 space-y-2.5">
									{laneSteps.map((s) => {
										const stepIdx = JOB_STEPS.findIndex(
											(item) => item.id === s.id,
										);
										const state = stepState(stepIdx, activeStepIndex);
										const isActive = state === "active";
										const isDone = state === "done";
										const movesInfo = MOVE_CONFIG[s.moves];

										return (
											<button
												key={s.id}
												type="button"
												onClick={() => handleSelectStep(stepIdx)}
												aria-label={`Step ${s.n}: ${s.title}`}
												className={cn(
													"w-full cursor-pointer rounded-xl border p-3 text-left transition-all duration-200 outline-none",
													isActive
														? "bg-surface-2 border-lumen ring-lumen/40 shadow-sm ring-1"
														: isDone
															? "bg-surface-1/90 border-border hover:border-border-strong text-fg-2"
															: "bg-surface-1/40 border-border/40 text-fg-3 hover:border-border hover:bg-surface-1",
												)}
											>
												{/* Step Number & Title Header */}
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-2">
														<span
															className={cn(
																"rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold",
																isActive
																	? "bg-lumen text-lumen-ink"
																	: isDone
																		? "bg-surface-3 text-fg-2"
																		: "bg-surface-2 text-fg-3",
															)}
														>
															{s.n < 10 ? `0${s.n}` : s.n}
														</span>
														<span
															className={cn(
																"text-xs font-medium transition-colors",
																isActive
																	? "text-fg font-semibold"
																	: isDone
																		? "text-fg"
																		: "text-fg-3",
															)}
														>
															{s.title}
														</span>
													</div>
													{isDone ? (
														<span className="text-moss">
															<Check size={13} weight="bold" />
														</span>
													) : isActive ? (
														<span
															className="bg-lumen size-2 rounded-full motion-safe:animate-pulse"
															aria-hidden="true"
														/>
													) : null}
												</div>

												{/* Step Description */}
												<p
													className={cn(
														"mt-1.5 text-[11px] leading-snug",
														isActive
															? "text-fg-2"
															: isDone
																? "text-fg-3"
																: "text-fg-3/70",
													)}
												>
													{s.line}
												</p>

												{/* Movement Badge */}
												{s.moves !== "none" && (
													<div className="mt-2 flex items-center gap-1.5">
														<span
															className={cn(
																"inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase",
																movesInfo.bg,
																movesInfo.text,
															)}
														>
															<movesInfo.icon size={10} weight="fill" />
															{s.moves === "money" ? "0G Escrow" : "Ciphertext"}
														</span>
													</div>
												)}
											</button>
										);
									})}
								</div>
							</div>

							{/* Architectural Capability & Guarantee Block (Fills empty space with authentic specs) */}
							<div className="bg-surface-2/40 border-border/60 mt-4 rounded-xl border p-2.5">
								<div className="flex items-center justify-between gap-1">
									<span className="text-fg font-sans text-xs font-semibold">
										{spec.guaranteeTitle}
									</span>
									<span className="text-fg-3 font-mono text-[9px] tracking-wider uppercase">
										{spec.protocolFeature}
									</span>
								</div>
								<p className="text-fg-3 mt-1 text-[11px] leading-relaxed">
									{spec.guaranteeDesc}
								</p>
								<div className="border-border/40 text-fg-3 mt-2 border-t pt-1.5 font-mono text-[10px]">
									{spec.techStack}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Live Execution Inspector Bar (Bottom) */}
			<div
				className="bg-surface-1 border-border mt-5 flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center"
				aria-live="polite"
			>
				<div className="flex items-start gap-3">
					<div className="bg-lumen text-lumen-ink shrink-0 rounded-xl p-2.5 font-mono text-sm font-bold tabular-nums">
						{current.n < 10 ? `0${current.n}` : current.n}
					</div>
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-fg font-sans text-sm font-semibold">
								{current.title}
							</h3>
							<span className="text-fg-3 text-xs">·</span>
							<span className="text-fg-2 text-xs">
								Active Actor: {currentLane?.label} ({currentLane?.note})
							</span>
						</div>
						<p className="text-fg-2 mt-0.5 text-xs">{current.line}</p>
					</div>
				</div>

				{/* Technical Guarantee Tag */}
				<div className="flex shrink-0 items-center gap-2.5">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
							moveConfig.border,
							moveConfig.bg,
							moveConfig.text,
						)}
					>
						<moveConfig.icon size={14} weight="fill" />
						<span>{moveConfig.label}</span>
					</span>
					<span className="text-fg-3 font-mono text-xs">
						{movesNote(current.moves)}
					</span>
				</div>
			</div>
		</section>
	);
}
