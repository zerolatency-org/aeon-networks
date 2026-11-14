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
import { useCallback, useEffect, useRef, useState } from "react";
import { JOB_STEPS, LANES, type LaneId } from "@/content/marketing";
import { laneColumn, movesNote, stepState } from "@/lib/job-scene";
import { cn } from "@/lib/utils";

const LANE_ICONS: Record<LaneId, React.ComponentType<IconProps>> = {
	owner: User,
	aeon: ShieldCheck,
	chain: Coins,
	provider: Cpu,
	verifier: CheckCircle,
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

interface CardPoint {
	x: number;
	y: number;
	topY: number;
	bottomY: number;
}

export function JobScene() {
	const containerRef = useRef<HTMLElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const [activeStepIndex, setActiveStepIndex] = useState(0);
	const [scrollProgress, setScrollProgress] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [cardPoints, setCardPoints] = useState<CardPoint[]>([]);

	// Measure card centers and ports to draw connecting lines
	const updateCardPoints = useCallback(() => {
		if (!gridRef.current) return;
		const parentRect = gridRef.current.getBoundingClientRect();
		if (parentRect.width === 0) return;

		const points: CardPoint[] = [];
		for (let i = 0; i < JOB_STEPS.length; i++) {
			const el = cardRefs.current[i];
			if (el) {
				const r = el.getBoundingClientRect();
				points.push({
					x: r.left - parentRect.left + r.width / 2,
					y: r.top - parentRect.top + r.height / 2,
					topY: r.top - parentRect.top,
					bottomY: r.bottom - parentRect.top,
				});
			} else {
				// Fallback approximation based on 5-column grid
				const col = laneColumn(JOB_STEPS[i].lane);
				const colWidth = parentRect.width / 5;
				points.push({
					x: (col - 0.5) * colWidth,
					y: (i + 0.5) * 60,
					topY: i * 60,
					bottomY: (i + 1) * 60,
				});
			}
		}
		setCardPoints(points);
	}, []);

	// Observe grid dimensions and card positions
	useEffect(() => {
		updateCardPoints();
		const ro = new ResizeObserver(() => {
			updateCardPoints();
		});
		if (gridRef.current) {
			ro.observe(gridRef.current);
		}
		window.addEventListener("resize", updateCardPoints);
		return () => {
			ro.disconnect();
			window.removeEventListener("resize", updateCardPoints);
		};
	}, [updateCardPoints]);

	// Smooth scroll-driven animation tracking
	useEffect(() => {
		let rafId: number;

		const handleScroll = () => {
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const totalScrollable =
				containerRef.current.offsetHeight - window.innerHeight;
			if (totalScrollable <= 0) return;

			// Top margin offset before pinning / scrubbing begins
			const topOffset = 48;
			const currentScrolled = topOffset - rect.top;
			const progress = Math.max(
				0,
				Math.min(1, currentScrolled / totalScrollable),
			);

			setScrollProgress(progress);

			// Map progress directly to active step
			const targetStep = Math.min(
				JOB_STEPS.length - 1,
				Math.floor(progress * JOB_STEPS.length),
			);
			setActiveStepIndex(targetStep);
		};

		const onScroll = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(handleScroll);
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		handleScroll(); // Initial check

		return () => {
			window.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(rafId);
		};
	}, []);

	// Optional Auto-play stepper
	useEffect(() => {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setIsPlaying(false);
			return;
		}

		if (!isPlaying) return;

		const timer = setInterval(() => {
			setActiveStepIndex((prev) => {
				const next = (prev + 1) % JOB_STEPS.length;
				// If auto-playing, also smoothly scroll to that step in container
				if (containerRef.current) {
					const rect = containerRef.current.getBoundingClientRect();
					const totalScrollable =
						containerRef.current.offsetHeight - window.innerHeight;
					const targetY =
						window.scrollY +
						rect.top -
						48 +
						(next / (JOB_STEPS.length - 1)) * totalScrollable;
					window.scrollTo({ top: targetY, behavior: "smooth" });
				}
				return next;
			});
		}, 3200);

		return () => clearInterval(timer);
	}, [isPlaying]);

	const current = JOB_STEPS[activeStepIndex] ?? JOB_STEPS[0];
	const currentLane = LANES.find((l) => l.id === current.lane);
	const moveConfig = MOVE_CONFIG[current.moves];

	// Jump to a specific step with smooth scrolling
	const scrollToStep = (index: number) => {
		setIsPlaying(false);
		setActiveStepIndex(index);

		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			const totalScrollable =
				containerRef.current.offsetHeight - window.innerHeight;
			if (totalScrollable > 0) {
				const targetProgress = index / (JOB_STEPS.length - 1);
				const targetY =
					window.scrollY + rect.top - 48 + targetProgress * totalScrollable;
				window.scrollTo({ top: targetY, behavior: "smooth" });
			}
		}
	};

	const handlePrev = () => {
		const target =
			activeStepIndex === 0 ? JOB_STEPS.length - 1 : activeStepIndex - 1;
		scrollToStep(target);
	};

	const handleNext = () => {
		const target = (activeStepIndex + 1) % JOB_STEPS.length;
		scrollToStep(target);
	};

	// Generate connecting curves between step cards
	const renderConnectingPaths = () => {
		if (cardPoints.length < 2) return null;

		return JOB_STEPS.slice(0, -1).map((s, idx) => {
			const p1 = cardPoints[idx];
			const p2 = cardPoints[idx + 1];
			if (!p1 || !p2) return null;

			const startX = p1.x;
			const startY = p1.bottomY;
			const endX = p2.x;
			const endY = p2.topY;

			// Smooth S-curve bezier or straight line
			let d = "";
			if (Math.abs(startX - endX) < 4) {
				d = `M ${startX} ${startY} L ${endX} ${endY}`;
			} else {
				const midY = (startY + endY) / 2;
				d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
			}

			const isPassed = idx < activeStepIndex;
			const isCurrentConnection = idx === activeStepIndex - 1;

			return (
				<g key={`path-${s.id}`}>
					{/* Inactive base dotted line */}
					<path
						d={d}
						fill="none"
						stroke="var(--border)"
						strokeWidth={1.5}
						strokeDasharray="4 4"
						opacity={0.45}
					/>

					{/* Active animated flowing dotted line */}
					{(isPassed || isCurrentConnection) && (
						<path
							d={d}
							fill="none"
							stroke="var(--lumen)"
							strokeWidth={2.5}
							strokeDasharray="6 6"
							className="dash-flow"
						/>
					)}
				</g>
			);
		});
	};

	// Active traveling packet position
	const activePoint = cardPoints[activeStepIndex];

	return (
		<section
			ref={containerRef}
			id="workflow-section"
			className="relative min-h-[250vh]"
			aria-labelledby="job-title"
		>
			{/* Sticky Stage Container */}
			<div className="sticky top-12 flex min-h-[calc(100vh-3rem)] flex-col justify-center px-4 py-6 md:px-6">
				<div className="mx-auto w-full max-w-[1280px]">
					{/* Section Header & Progress Status */}
					<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
						<div>
							<div className="flex items-center gap-2">
								<span className="text-lumen-fg font-mono text-xs font-semibold tracking-wider uppercase">
									Decentralized Workflow
								</span>
								<span className="text-fg-3 text-xs">·</span>
								<span className="text-fg-2 font-mono text-xs">
									Scroll-driven autonomous execution
								</span>
							</div>
							<h2
								id="job-title"
								className="text-fg font-serif text-3xl md:text-5xl"
							>
								How a job works
							</h2>
							<p className="text-fg-2 mt-1.5 max-w-[56ch] text-base md:text-lg">
								Money moves only on chain. Content moves only as ciphertext.
								Trace the live route across 5 decentralized actors.
							</p>
						</div>

						{/* Stepper Controls & Scroll Scrubber Pill */}
						<div className="flex flex-wrap items-center gap-3">
							{/* Scroll Progress Meter */}
							<div className="bg-surface-1 border-border flex items-center gap-2.5 rounded-xl border px-3 py-1.5">
								<span className="text-fg-3 font-mono text-xs font-semibold">
									Step {current.n < 10 ? `0${current.n}` : current.n}/10
								</span>
								<div className="bg-surface-2 h-1.5 w-20 overflow-hidden rounded-full">
									<div
										className="bg-lumen h-full rounded-full transition-all duration-150"
										style={{ width: `${Math.round(scrollProgress * 100)}%` }}
									/>
								</div>
							</div>

							{/* Prev / Play / Next Controls */}
							<div className="bg-surface-1 border-border flex items-center gap-1 rounded-xl border p-1">
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
											: "Play workflow auto-stepper"
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

					{/* Step Selector Pills Bar */}
					<div
						className="mt-5 flex scrollbar-none items-center gap-1.5 overflow-x-auto pb-1"
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
									onClick={() => scrollToStep(idx)}
									className={cn(
										"flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all",
										isActive
											? "bg-lumen text-lumen-ink border-lumen font-medium shadow-sm"
											: isPast
												? "bg-surface-1 text-fg border-border hover:bg-surface-2"
												: "bg-surface-1/50 text-fg-3 border-border/50 hover:bg-surface-2 hover:text-fg-2",
									)}
								>
									<span className="font-mono">
										{s.n < 10 ? `0${s.n}` : s.n}
									</span>
									<span>{s.title}</span>
								</button>
							);
						})}
					</div>

					{/* Main Diagram Area with Swimlane Tracks & Connecting Dotted Lines */}
					<div className="bg-surface-1 border-border mt-4 rounded-2xl border p-4 shadow-sm md:p-5">
						{/* 5 Actor Swimlane Headers */}
						<div className="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-3 lg:grid-cols-5">
							{LANES.map((l) => {
								const Icon = LANE_ICONS[l.id];
								const isLaneActive = current.lane === l.id;
								return (
									<div
										key={l.id}
										className={cn(
											"rounded-xl border p-2.5 transition-all duration-300",
											isLaneActive
												? "bg-surface-2 border-lumen text-fg ring-lumen/40 ring-1"
												: "bg-surface-1/80 border-border text-fg-3",
										)}
									>
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"rounded-md p-1.5 transition-colors",
													isLaneActive
														? "bg-lumen text-lumen-ink"
														: "bg-surface-2 text-fg-2",
												)}
											>
												<Icon size={15} weight="duotone" />
											</div>
											<div className="min-w-0">
												<p className="text-fg truncate text-xs leading-tight font-semibold">
													{l.label}
												</p>
												<p className="text-fg-3 mt-0.5 truncate text-[11px] leading-tight">
													{l.note}
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>

						{/* Desktop Workflow Swimlane Matrix */}
						<div
							ref={gridRef}
							className="relative mt-3 hidden min-h-[380px] lg:block"
						>
							{/* 5 Vertical Swimlane Guide Tracks (Eliminates Empty Space) */}
							<div className="pointer-events-none absolute inset-0 grid grid-cols-5 gap-3">
								{LANES.map((l) => {
									const isLaneActive = current.lane === l.id;
									return (
										<div
											key={`track-${l.id}`}
											className={cn(
												"flex h-full flex-col justify-end rounded-xl border border-dashed p-3 transition-colors duration-300",
												isLaneActive
													? "bg-lumen/5 border-lumen/30"
													: "bg-surface-2/15 border-border/25",
											)}
										>
											<span className="text-fg-3 font-mono text-[10px] tracking-wider uppercase opacity-40">
												{l.label} Track
											</span>
										</div>
									);
								})}
							</div>

							{/* SVG Animated Connecting Dotted Lines */}
							<svg
								className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
								aria-hidden="true"
							>
								{renderConnectingPaths()}

								{/* Animated Traveling Packet Dot on Active Node */}
								{activePoint && (
									<g
										transform={`translate(${activePoint.x}, ${activePoint.y})`}
									>
										<circle
											r={12}
											fill="var(--lumen)"
											opacity={0.25}
											className="motion-safe:animate-ping"
										/>
										<circle
											r={5}
											fill="var(--lumen)"
											stroke="var(--lumen-ink)"
											strokeWidth={1.5}
										/>
									</g>
								)}
							</svg>

							{/* Step Node Cards Matrix */}
							<div className="relative z-20 grid grid-cols-5 gap-x-3 gap-y-2.5">
								{JOB_STEPS.map((s, idx) => {
									const col = laneColumn(s.lane);
									const state = stepState(idx, activeStepIndex);
									const isActive = state === "active";
									const isDone = state === "done";
									const movesInfo = MOVE_CONFIG[s.moves];

									return (
										<button
											key={s.id}
											ref={(el) => {
												cardRefs.current[idx] = el;
											}}
											type="button"
											style={{ gridColumn: col }}
											onClick={() => scrollToStep(idx)}
											aria-label={`Step ${s.n}: ${s.title}`}
											className={cn(
												"group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 outline-none",
												isActive
													? "bg-surface-2 border-lumen ring-lumen/40 translate-y-[-2px] shadow-md ring-2"
													: isDone
														? "bg-surface-1 border-border hover:border-border-strong text-fg-2"
														: "bg-surface-1/70 border-border/50 text-fg-3 hover:border-border hover:bg-surface-1",
											)}
										>
											{/* Top Connector Port Indicator */}
											<span
												className={cn(
													"absolute -top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full border transition-colors",
													isActive
														? "bg-lumen border-lumen ring-lumen ring-1"
														: isDone
															? "bg-border border-border"
															: "bg-surface-2 border-border/50",
												)}
												aria-hidden="true"
											/>

											{/* Step Node Header */}
											<div className="flex items-center justify-between gap-1.5">
												<div className="flex items-center gap-1.5">
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
													"mt-1.5 line-clamp-2 text-[11px] leading-snug",
													isActive
														? "text-fg-2"
														: isDone
															? "text-fg-3"
															: "text-fg-3/80",
												)}
											>
												{s.line}
											</p>

											{/* Movement Type Tag */}
											{s.moves !== "none" && (
												<div className="mt-2 flex items-center gap-1">
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

											{/* Bottom Connector Port Indicator */}
											<span
												className={cn(
													"absolute -bottom-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full border transition-colors",
													isActive
														? "bg-lumen border-lumen ring-lumen ring-1"
														: isDone
															? "bg-border border-border"
															: "bg-surface-2 border-border/50",
												)}
												aria-hidden="true"
											/>
										</button>
									);
								})}
							</div>
						</div>

						{/* Mobile / Tablet Step View */}
						<div className="mt-4 flex flex-col gap-2.5 lg:hidden">
							{JOB_STEPS.map((s, idx) => {
								const state = stepState(idx, activeStepIndex);
								const isActive = state === "active";
								const isDone = state === "done";
								const lane = LANES.find((l) => l.id === s.lane);
								const movesInfo = MOVE_CONFIG[s.moves];

								return (
									<button
										key={s.id}
										type="button"
										onClick={() => scrollToStep(idx)}
										className={cn(
											"flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
											isActive
												? "bg-surface-2 border-lumen ring-lumen/40 ring-1"
												: isDone
													? "bg-surface-1 border-border text-fg-2"
													: "bg-surface-1/40 border-border/40 text-fg-3",
										)}
									>
										<div className="flex items-start gap-3">
											<span
												className={cn(
													"shrink-0 rounded px-2 py-1 font-mono text-xs font-semibold",
													isActive
														? "bg-lumen text-lumen-ink"
														: isDone
															? "bg-surface-3 text-fg-2"
															: "bg-surface-2 text-fg-3",
												)}
											>
												{s.n < 10 ? `0${s.n}` : s.n}
											</span>
											<div>
												<div className="flex flex-wrap items-center gap-2">
													<h3
														className={cn(
															"text-sm font-medium",
															isActive ? "text-fg" : "text-fg-2",
														)}
													>
														{s.title}
													</h3>
													<span className="text-fg-3 text-xs">
														· {lane?.label}
													</span>
												</div>
												<p className="text-fg-3 mt-1 text-xs">{s.line}</p>
											</div>
										</div>

										{s.moves !== "none" && (
											<span
												className={cn(
													"shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase",
													movesInfo.bg,
													movesInfo.text,
												)}
											>
												{s.moves === "money" ? "0G Escrow" : "Ciphertext"}
											</span>
										)}
									</button>
								);
							})}
						</div>

						{/* Live Step Inspector Bar */}
						<div
							className="bg-surface-2/70 border-border mt-3 flex flex-col justify-between gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center"
							aria-live="polite"
						>
							<div className="flex items-start gap-3">
								<div className="bg-lumen text-lumen-ink shrink-0 rounded-lg p-2 font-mono text-xs font-bold">
									0{current.n}
								</div>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-fg text-sm font-semibold">
											{current.title}
										</p>
										<span className="text-fg-3 text-xs">·</span>
										<span className="text-fg-2 text-xs">
											{currentLane?.label} ({currentLane?.note})
										</span>
									</div>
									<p className="text-fg-2 mt-0.5 text-xs">{current.line}</p>
								</div>
							</div>

							{/* Movement Guarantee Tag */}
							<div className="flex shrink-0 items-center gap-2">
								<span
									className={cn(
										"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
										moveConfig.border,
										moveConfig.bg,
										moveConfig.text,
									)}
								>
									<moveConfig.icon size={13} weight="fill" />
									<span>{moveConfig.label}</span>
								</span>
								<span className="text-fg-3 font-mono text-xs">
									{movesNote(current.moves)}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
