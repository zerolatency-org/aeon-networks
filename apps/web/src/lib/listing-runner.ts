// apps/web/src/lib/listing-runner.ts
import type { Hex, Problem, TxRequest } from "./agents-parse";
import { walletProblem } from "./mint-runner";
import { ApiError } from "./siwe-api";

export type ListingAction = "list" | "update" | "delist";

export type ListingDraft = {
	agentId: string;
	action: ListingAction;
	priceWei?: string;
	tags?: string[];
};

export type PreparedListing = {
	profileHash: Hex | null;
	tx: TxRequest;
};

export type ConfirmedListing = {
	listings: {
		tokenId: string;
		listing: {
			tokenId: string;
			name: string;
			description: string;
			tags: string[];
			price: string;
			owner: string;
			agentWallet: string;
			jobsCompleted: number;
			jobsDisputed: number;
			totalSettled: string;
			profileHash: string;
		} | null;
	}[];
};

export type ListingDeps = {
	prepare: (draft: ListingDraft) => Promise<PreparedListing>;
	sendTx: (tx: TxRequest) => Promise<Hex>;
	waitMined: (hash: Hex) => Promise<"success" | "reverted">;
	confirm: (input: { txHash: string }) => Promise<ConfirmedListing>;
	sleep: (ms: number) => Promise<void>;
};

export type ListingSession = {
	prepared: PreparedListing | null;
	txHash: Hex | null;
	txMined: boolean;
	confirmed: ConfirmedListing | null;
};

export const newListingSession = (): ListingSession => ({
	prepared: null,
	txHash: null,
	txMined: false,
	confirmed: null,
});

export type ListingStep =
	| "prepare"
	| "send"
	| "mining"
	| "confirm"
	| "done"
	| "failed";

export type ListingEvent = {
	step: ListingStep;
	problem?: Problem;
};

export const CONFIRM_ATTEMPTS = 15;
export const CONFIRM_WAIT_MS = 2000;

export async function runListing(
	draft: ListingDraft,
	session: ListingSession,
	deps: ListingDeps,
	onEvent: (e: ListingEvent) => void,
): Promise<
	{ ok: true; data: ConfirmedListing } | { ok: false; problem: Problem }
> {
	try {
		// 1. Prepare
		if (!session.prepared) {
			onEvent({ step: "prepare" });
			session.prepared = await deps.prepare(draft);
		}

		// 2. Send transaction in wallet
		if (!session.txHash) {
			onEvent({ step: "send" });
			try {
				session.txHash = await deps.sendTx(session.prepared.tx);
			} catch (err) {
				const problem = walletProblem(err);
				onEvent({ step: "failed", problem });
				return { ok: false, problem };
			}
		}

		// 3. Wait for mining
		if (!session.txMined) {
			onEvent({ step: "mining" });
			const status = await deps.waitMined(session.txHash);
			if (status === "reverted") {
				const problem: Problem = {
					code: "TX_REVERTED",
					message: "The listing transaction failed on chain.",
					retryable: false,
				};
				onEvent({ step: "failed", problem });
				return { ok: false, problem };
			}
			session.txMined = true;
		}

		// 4. Confirm with server (retry if NOT_MINED / 409)
		if (!session.confirmed) {
			onEvent({ step: "confirm" });
			let lastErr: unknown = null;
			for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
				try {
					session.confirmed = await deps.confirm({ txHash: session.txHash });
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
			if (!session.confirmed && lastErr) {
				throw lastErr;
			}
		}

		if (!session.confirmed) {
			throw new Error("Listing confirmation missing");
		}
		onEvent({ step: "done" });
		return { ok: true, data: session.confirmed };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Listing failed";
		const code = err instanceof ApiError ? err.code : "LISTING_ERROR";
		const problem: Problem = {
			code,
			message,
			retryable: true,
		};
		onEvent({ step: "failed", problem });
		return { ok: false, problem };
	}
}

export function createDefaultListingDeps(
	sendTxFn: (tx: TxRequest) => Promise<Hex>,
	waitMinedFn: (hash: Hex) => Promise<"success" | "reverted">,
): ListingDeps {
	return {
		prepare: async (draft) => {
			const res = await fetch("/api/market/listings/prepare", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					agentId: draft.agentId,
					action: draft.action,
					price: draft.priceWei,
					tags: draft.tags ?? [],
				}),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					code?: string;
					message?: string;
				};
				throw new ApiError(body.code || "PREPARE_FAILED", res.status);
			}
			return res.json();
		},
		sendTx: sendTxFn,
		waitMined: waitMinedFn,
		confirm: async ({ txHash }) => {
			const res = await fetch("/api/market/listings/confirm", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ txHash }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as {
					code?: string;
					message?: string;
				};
				throw new ApiError(body.code || "CONFIRM_FAILED", res.status);
			}
			return res.json();
		},
		sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	};
}
