// apps/web/src/lib/mint-runner.ts
// Runs the mint: prepare, the owner's mint, confirm, the owner's authorize, then face and limits.
// Everything it touches (server, wallet, clock) is passed in, so the order and the retries are
// testable. It keeps what it has finished in a session, so running it again after a failure
// resumes at the step that failed and never sends a transaction twice.
import type { PrepareInput } from "./agents-api";
import {
	type AvatarChoice,
	type Confirmed,
	type Hex,
	mintProblem,
	type PolicyInput,
	type Prepared,
	type Problem,
	type TxRequest,
} from "./agents-parse";
import type { MintEvent } from "./mint-flow";
import { ApiError } from "./siwe-api";
import type { WizardDraft } from "./wizard";

export type MintDeps = {
	prepare: (input: PrepareInput) => Promise<Prepared>;
	/** Asks the owner's wallet to send the transaction. Resolves with the hash once it is submitted. */
	sendTx: (tx: TxRequest) => Promise<Hex>;
	waitMined: (hash: Hex) => Promise<"success" | "reverted">;
	confirm: (input: { draftId: string; txHash: string }) => Promise<Confirmed>;
	saveAvatar: (agentId: string, choice: AvatarChoice) => Promise<unknown>;
	savePolicy: (agentId: string, policy: PolicyInput) => Promise<unknown>;
	sleep: (ms: number) => Promise<void>;
};

/** What has been done so far. Keep one per mint and pass it to every run. */
export type MintSession = {
	prepared: Prepared | null;
	mintHash: Hex | null;
	mintMined: boolean;
	confirmed: Confirmed | null;
	authorizeHash: Hex | null;
	authorizeMined: boolean;
	avatarSaved: boolean;
	policySaved: boolean;
};

export const newSession = (): MintSession => ({
	prepared: null,
	mintHash: null,
	mintMined: false,
	confirmed: null,
	authorizeHash: null,
	authorizeMined: false,
	avatarSaved: false,
	policySaved: false,
});

/** The server may not see the mint yet when the wallet does: ask again, up to about 30 seconds. */
export const CONFIRM_ATTEMPTS = 15;
export const CONFIRM_WAIT_MS = 2000;

/** The body for `prepare`, or null when a required choice is missing. */
export function prepareInput(draft: WizardDraft): PrepareInput | null {
	if (!draft.model || draft.name.trim() === "") return null;
	return {
		name: draft.name.trim(),
		description: draft.description.trim(),
		model: draft.model,
		persona: draft.persona,
	};
}

function causes(
	error: unknown,
): { code?: unknown; name?: unknown; message?: unknown }[] {
	const out: { code?: unknown; name?: unknown; message?: unknown }[] = [];
	let cur: unknown = error;
	for (let i = 0; i < 6 && typeof cur === "object" && cur !== null; i++) {
		out.push(cur as { code?: unknown; name?: unknown; message?: unknown });
		cur = (cur as { cause?: unknown }).cause;
	}
	return out;
}

/** Words for whatever the wallet threw. viem wraps the wallet's error, so look down the cause chain. */
export function walletProblem(error: unknown): Problem {
	const chain = causes(error);
	const text = chain.map((c) => String(c.message ?? "")).join(" ");
	if (
		chain.some(
			(c) => c.code === 4001 || c.name === "UserRejectedRequestError",
		) ||
		/user rejected|user denied|rejected the request/i.test(text)
	) {
		return {
			code: "USER_REJECTED",
			message:
				"You cancelled in your wallet. Nothing was spent. Try again when you are ready.",
			retryable: true,
		};
	}
	if (
		chain.some((c) => c.name === "InsufficientFundsError") ||
		/insufficient funds/i.test(text)
	) {
		return {
			code: "INSUFFICIENT_FUNDS",
			message:
				"Your wallet does not have enough 0G for the fee and gas. Add some and try again.",
			retryable: true,
		};
	}
	return {
		code: "WALLET_ERROR",
		message:
			"The wallet could not send the transaction. Check it and try again.",
		retryable: true,
	};
}

const AUTHORIZE_FAILED: Problem = {
	code: "AUTHORIZE_FAILED",
	message: "The authorization did not go through. Try again.",
	retryable: true,
};

const savingProblem = (what: string, error: unknown): Problem => ({
	code: mintProblem(error).code,
	message: `Your agent is live, but saving its ${what} failed. Try again.`,
	retryable: true,
});

/**
 * Runs every step that is not finished yet and reports each completed step with `emit`.
 * Returns "failed" after emitting a `fail` event; call it again after a `retry` to resume.
 */
export async function runMint(
	draft: WizardDraft,
	session: MintSession,
	deps: MintDeps,
	emit: (event: MintEvent) => void,
): Promise<"done" | "failed"> {
	const fail = (problem: Problem) => {
		emit({ type: "fail", problem });
		return "failed" as const;
	};

	// 1. prepare
	if (!session.prepared) {
		const body = prepareInput(draft);
		if (!body) {
			return fail({
				code: "INCOMPLETE",
				message: "Some choices are missing. Go back and finish every step.",
				retryable: false,
			});
		}
		try {
			session.prepared = await deps.prepare(body);
		} catch (e) {
			return fail(mintProblem(e));
		}
		emit({ type: "advance", feeWei: session.prepared.mint.value });
	}
	const prepared = session.prepared;

	// 2. the owner signs the mint. The hash is stored before waiting, so a retry waits instead of paying twice.
	if (!session.mintMined) {
		if (!session.mintHash) {
			try {
				session.mintHash = await deps.sendTx(prepared.mint);
			} catch (e) {
				return fail(walletProblem(e));
			}
		}
		let outcome: "success" | "reverted";
		try {
			outcome = await deps.waitMined(session.mintHash);
		} catch (e) {
			return fail(mintProblem(e));
		}
		if (outcome === "reverted")
			return fail(mintProblem(new ApiError("MINT_FAILED", 400)));
		session.mintMined = true;
		emit({ type: "advance" });
	}

	// 3. the server checks the mint on chain
	if (!session.confirmed) {
		for (let attempt = 1; ; attempt++) {
			try {
				session.confirmed = await deps.confirm({
					draftId: prepared.draftId,
					txHash: session.mintHash as Hex,
				});
				break;
			} catch (e) {
				const problem = mintProblem(e);
				if (problem.code === "NOT_MINED" && attempt < CONFIRM_ATTEMPTS) {
					await deps.sleep(CONFIRM_WAIT_MS);
					continue;
				}
				return fail(problem);
			}
		}
		emit({ type: "advance" });
	}
	const confirmed = session.confirmed;

	// 4. the owner signs authorizeUsage
	if (!session.authorizeMined) {
		if (!session.authorizeHash) {
			try {
				session.authorizeHash = await deps.sendTx(confirmed.authorize);
			} catch (e) {
				return fail(walletProblem(e));
			}
		}
		let outcome: "success" | "reverted";
		try {
			outcome = await deps.waitMined(session.authorizeHash);
		} catch (e) {
			return fail(mintProblem(e));
		}
		if (outcome === "reverted") {
			session.authorizeHash = null; // a failed send can be sent again
			return fail(AUTHORIZE_FAILED);
		}
		session.authorizeMined = true;
		emit({ type: "advance" });
	}

	// 5. face and limits (the agent is already live; each is saved once)
	const agentId = confirmed.agent.id;
	if (draft.avatar && !session.avatarSaved) {
		try {
			await deps.saveAvatar(agentId, draft.avatar);
			session.avatarSaved = true;
		} catch (e) {
			return fail(savingProblem("face", e));
		}
	}
	if (draft.policy && !session.policySaved) {
		try {
			await deps.savePolicy(agentId, draft.policy);
			session.policySaved = true;
		} catch (e) {
			return fail(savingProblem("spending limits", e));
		}
	}
	emit({ type: "advance" });
	return "done";
}
