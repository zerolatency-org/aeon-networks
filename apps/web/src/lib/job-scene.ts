import { JOB_STEPS, LANES, type Moves } from "@/content/marketing";
export function activeStep(progress: number, steps = JOB_STEPS.length) {
	if (steps <= 0) return 0;
	const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
	return Math.min(steps - 1, Math.floor(p * steps));
}
export type StepState = "done" | "active" | "waiting";
export const stepState = (index: number, active: number): StepState =>
	index < active ? "done" : index === active ? "active" : "waiting";
export const laneColumn = (lane: string) =>
	Math.max(1, LANES.findIndex((l) => l.id === lane) + 1);
export const pinLength = (steps = JOB_STEPS.length) => `+=${steps * 45}%`;
export const movesNote = (moves: Moves) =>
	moves === "money"
		? "Money moves here, and only on chain."
		: moves === "content"
			? "Content moves as ciphertext only."
			: "Nothing sensitive moves in this step.";
