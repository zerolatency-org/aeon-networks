// apps/web/src/lib/mint-flow.ts
// The mint as five visible steps, and the rules for moving between them. The runner in the next
// part sends events here; the tracker on screen reads the result. Pure: no wallet, no fetching.
import type { Problem } from "./agents-parse";
import { formatOg } from "./format";

export const MINT_STEPS = [
	"prepare",
	"mint",
	"confirm",
	"authorize",
	"finish",
] as const;
export type MintStep = (typeof MINT_STEPS)[number];

export const MINT_LABELS: Record<MintStep, { title: string; hint: string }> = {
	prepare: {
		title: "Create the agent wallet",
		hint: "Aeon makes a wallet for your agent and seals its key.",
	},
	mint: {
		title: "Mint in your wallet",
		hint: "Approve the mint in MetaMask. This is the only payment.",
	},
	confirm: {
		title: "Wait for the chain",
		hint: "Aeon checks the mint on chain before creating your agent.",
	},
	authorize: {
		title: "Let the agent sign",
		hint: "A second approval lets the agent's wallet sign its own jobs.",
	},
	finish: {
		title: "Save face and limits",
		hint: "Your chosen face and spending limits are saved.",
	},
};

export type MintProgress = {
	status: "idle" | "running" | "failed" | "done";
	/** the step in progress, or the step that failed; null when idle or done */
	step: MintStep | null;
	problem: Problem | null;
	/** the mint fee in wei, known once the server has prepared the mint */
	feeWei: string | null;
};

export type MintEvent =
	| { type: "start" }
	/** the current step finished; `feeWei` comes with the prepare step */
	| { type: "advance"; feeWei?: string }
	| { type: "fail"; problem: Problem }
	| { type: "retry" }
	| { type: "reset" };

export const initialProgress: MintProgress = {
	status: "idle",
	step: null,
	problem: null,
	feeWei: null,
};

export function mintReducer(s: MintProgress, e: MintEvent): MintProgress {
	if (e.type === "reset") return initialProgress;
	switch (s.status) {
		case "idle":
			return e.type === "start"
				? { ...initialProgress, status: "running", step: "prepare" }
				: s;
		case "running": {
			if (e.type === "fail")
				return { ...s, status: "failed", problem: e.problem };
			if (e.type !== "advance" || s.step === null) return s;
			const feeWei = e.feeWei ?? s.feeWei;
			const next = MINT_STEPS[MINT_STEPS.indexOf(s.step) + 1];
			return next
				? { ...s, step: next, feeWei }
				: { status: "done", step: null, problem: null, feeWei };
		}
		case "failed":
			// Only a failure that can work on a second try is retried; the rest need a fresh start.
			return e.type === "retry" && s.problem?.retryable
				? { ...s, status: "running", problem: null }
				: s;
		case "done":
			return s;
	}
}

export type TrackerRow = {
	step: MintStep;
	title: string;
	hint: string;
	state: "done" | "active" | "failed" | "pending";
	/** a short extra line, like the fee under the mint step */
	note: string | null;
};

export function trackerRows(s: MintProgress): TrackerRow[] {
	const current = s.step === null ? -1 : MINT_STEPS.indexOf(s.step);
	return MINT_STEPS.map((step, i) => {
		let state: TrackerRow["state"] = "pending";
		if (s.status === "done" || (current !== -1 && i < current)) state = "done";
		else if (i === current) state = s.status === "failed" ? "failed" : "active";
		const fee =
			step === "mint" && s.feeWei !== null
				? `Fee: ${formatOg(BigInt(s.feeWei))} 0G plus gas`
				: null;
		const note = state === "failed" && s.problem ? s.problem.message : fee;
		return { step, ...MINT_LABELS[step], state, note };
	});
}

/** The agent exists on chain once the confirm step is done, so a failure after that must not start over. */
export function agentExists(s: MintProgress): boolean {
	if (s.status === "done") return true;
	const i = s.step === null ? -1 : MINT_STEPS.indexOf(s.step);
	return i > MINT_STEPS.indexOf("confirm");
}
