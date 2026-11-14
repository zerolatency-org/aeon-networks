// apps/web/src/lib/login-problems.ts
import { ApiError } from "./siwe-api";

export const PROBLEMS = [
	"wallet-taken",
	"signature-rejected",
	"wrong-network",
	"popup-blocked",
	"expired",
	"bad-signature",
	"wrong-site",
	"session-needed",
	"unknown",
] as const;
export type LoginProblem = (typeof PROBLEMS)[number];

export const PROBLEM_COPY: Record<
	LoginProblem,
	{ title: string; hint: string }
> = {
	"wallet-taken": {
		title: "This wallet belongs to another account",
		hint: "Sign in with the account that owns it, or connect a different wallet.",
	},
	"signature-rejected": {
		title: "Signature cancelled",
		hint: "Nothing was sent. Sign the message when you are ready; it costs nothing.",
	},
	"wrong-network": {
		title: "Switch to 0G Galileo",
		hint: "Aeon runs on the Galileo testnet, chain 16602. Switch networks in your wallet and try again.",
	},
	"popup-blocked": {
		title: "The sign-in window was blocked",
		hint: "Allow pop-ups for this site, then try again.",
	},
	expired: {
		title: "That request expired",
		hint: "Start again to get a fresh message to sign.",
	},
	"bad-signature": {
		title: "We could not verify the signature",
		hint: "Try again with the same wallet you connected.",
	},
	"wrong-site": {
		title: "Wallet sign-in is not set up for this address",
		hint: "Open Aeon from its usual address, or ask the team to check the site settings.",
	},
	"session-needed": {
		title: "Sign in first",
		hint: "Continue with Google or GitHub, then link your wallet.",
	},
	unknown: {
		title: "Something went wrong",
		hint: "Try again. If it keeps happening, reload the page.",
	},
};

const API_CODES: Record<string, LoginProblem> = {
	WALLET_TAKEN: "wallet-taken",
	SIWE_WRONG_CHAIN: "wrong-network",
	SIWE_EXPIRED: "expired",
	SIWE_NONCE_INVALID: "expired",
	SIWE_SIGNATURE_INVALID: "bad-signature",
	SIWE_WRONG_DOMAIN: "wrong-site",
	SIWE_MESSAGE_INVALID: "wrong-site",
	UNAUTHORIZED: "session-needed",
};

function wallet(error: unknown): {
	name: string;
	message: string;
	code: unknown;
} {
	const e = (typeof error === "object" && error !== null ? error : {}) as {
		name?: unknown;
		message?: unknown;
		code?: unknown;
		cause?: { code?: unknown };
	};
	return {
		name: typeof e.name === "string" ? e.name : "",
		message: typeof e.message === "string" ? e.message : "",
		code: e.code ?? e.cause?.code,
	};
}

/** Turns anything thrown during wallet sign-in or linking into one of the known problems. */
export function problemFrom(error: unknown): LoginProblem {
	if (error instanceof ApiError) {
		return (
			API_CODES[error.code] ??
			(error.status === 401 ? "bad-signature" : "unknown")
		);
	}
	const { name, message, code } = wallet(error);
	if (
		code === 4001 ||
		name === "UserRejectedRequestError" ||
		/user (rejected|denied)|rejected the request/i.test(message)
	) {
		return "signature-rejected";
	}
	if (
		name === "ChainMismatchError" ||
		name === "SwitchChainError" ||
		code === 4902 ||
		/chain mismatch|wrong network|switch (the )?chain/i.test(message)
	) {
		return "wrong-network";
	}
	if (/pop-?up/i.test(message)) return "popup-blocked";
	return "unknown";
}
