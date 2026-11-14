// apps/web/src/lib/hire-runner.ts
import type { Hex, Problem, TxRequest } from "./agents-parse";
import type { JobView, PreparedJob } from "./jobs-api";
import { walletProblem } from "./mint-runner";
import { ApiError } from "./siwe-api";

export type HireDraft = {
	tokenId: string;
	taskBrief: string;
	amountWei: string;
	evaluatorAddress?: string;
	taskHash: Hex;
	envelope: unknown;
};

export type HireSession = {
	prepared: PreparedJob | null;
	escrowHash: Hex | null;
	escrowMined: boolean;
	confirmedJob: JobView | null;
	taskDelivered: boolean;
};

export const newHireSession = (): HireSession => ({
	prepared: null,
	escrowHash: null,
	escrowMined: false,
	confirmedJob: null,
	taskDelivered: false,
});

export type HireStep =
	| "prepare"
	| "send"
	| "mining"
	| "confirm"
	| "deliver"
	| "done"
	| "failed";

export type HireEvent = {
	step: HireStep;
	problem?: Problem;
};

export type HireDeps = {
	prepare: (draft: HireDraft) => Promise<PreparedJob>;
	sendEscrowTx: (tx: TxRequest) => Promise<Hex>;
	waitMined: (hash: Hex) => Promise<"success" | "reverted">;
	confirm: (input: {
		txHash: string;
	}) => Promise<{ job: JobView; providerQueued: boolean }>;
	deliverTask: (jobId: string, envelope: unknown) => Promise<unknown>;
	sleep: (ms: number) => Promise<void>;
};

export const CONFIRM_ATTEMPTS = 15;
export const CONFIRM_WAIT_MS = 2000;

export async function runHire(
	draft: HireDraft,
	session: HireSession,
	deps: HireDeps,
	onEvent: (e: HireEvent) => void,
): Promise<{ ok: true; job: JobView } | { ok: false; problem: Problem }> {
	try {
		// 1. Prepare escrow job
		if (!session.prepared) {
			onEvent({ step: "prepare" });
			session.prepared = await deps.prepare(draft);
		}

		// 2. Fund escrow in wallet
		if (!session.escrowHash) {
			onEvent({ step: "send" });
			try {
				session.escrowHash = await deps.sendEscrowTx(session.prepared.tx);
			} catch (err) {
				const problem = walletProblem(err);
				onEvent({ step: "failed", problem });
				return { ok: false, problem };
			}
		}

		// 3. Wait for mining
		if (!session.escrowMined) {
			onEvent({ step: "mining" });
			const status = await deps.waitMined(session.escrowHash);
			if (status === "reverted") {
				const problem: Problem = {
					code: "ESCROW_TX_REVERTED",
					message: "The escrow funding transaction reverted on chain.",
					retryable: false,
				};
				onEvent({ step: "failed", problem });
				return { ok: false, problem };
			}
			session.escrowMined = true;
		}

		// 4. Confirm with server
		if (!session.confirmedJob) {
			onEvent({ step: "confirm" });
			let lastErr: unknown = null;
			for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
				try {
					const res = await deps.confirm({ txHash: session.escrowHash });
					session.confirmedJob = res.job;
					break;
				} catch (err) {
					lastErr = err;
					if (err instanceof ApiError && err.status === 409) {
						if (attempt < CONFIRM_ATTEMPTS - 1) {
							await deps.sleep(CONFIRM_WAIT_MS);
							continue;
						}
					}
					throw err;
				}
			}
			if (!session.confirmedJob && lastErr) {
				throw lastErr;
			}
		}

		// 5. Deliver encrypted task to mailbox
		if (!session.taskDelivered && session.confirmedJob) {
			onEvent({ step: "deliver" });
			await deps.deliverTask(session.confirmedJob.jobId, draft.envelope);
			session.taskDelivered = true;
		}

		onEvent({ step: "done" });
		if (!session.confirmedJob) {
			throw new Error("Confirmed job missing after run completion");
		}
		return { ok: true, job: session.confirmedJob };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Hire process failed";
		const code = err instanceof ApiError ? err.code : "HIRE_ERROR";
		const problem: Problem = {
			code,
			message,
			retryable: true,
		};
		onEvent({ step: "failed", problem });
		return { ok: false, problem };
	}
}

export function createDefaultHireDeps(
	sendTxFn: (tx: TxRequest) => Promise<Hex>,
	waitMinedFn: (hash: Hex) => Promise<"success" | "reverted">,
): HireDeps {
	return {
		prepare: async (draft) => {
			const res = await fetch("/api/jobs/prepare", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					tokenId: draft.tokenId,
					taskHash: draft.taskHash,
					amount: draft.amountWei,
					evaluator: draft.evaluatorAddress,
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { code?: string };
				throw new ApiError(body.code || "PREPARE_JOB_FAILED", res.status);
			}
			return res.json();
		},
		sendEscrowTx: sendTxFn,
		waitMined: waitMinedFn,
		confirm: async ({ txHash }) => {
			const res = await fetch("/api/jobs/confirm", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ txHash }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { code?: string };
				throw new ApiError(body.code || "CONFIRM_JOB_FAILED", res.status);
			}
			return res.json();
		},
		deliverTask: async (jobId, envelope) => {
			const res = await fetch(`/api/jobs/${jobId}/delivery/task`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ jobId, envelope }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { code?: string };
				throw new ApiError(body.code || "DELIVERY_FAILED", res.status);
			}
			return res.json();
		},
		sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	};
}
