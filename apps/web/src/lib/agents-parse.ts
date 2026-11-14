// apps/web/src/lib/agents-parse.ts
// What the agents API returns, checked before the app trusts it, and plain-words
// messages for every way minting can fail. Pure: no fetching here.
import { errorInfo } from "./retry";

export type Hex = `0x${string}`;

const isDigits = (v: unknown): v is string =>
	typeof v === "string" && /^\d{1,40}$/.test(v);
const isAddress = (v: unknown): v is Hex =>
	typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHexData = (v: unknown): v is Hex =>
	typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const isText = (v: unknown): v is string => typeof v === "string";

/** One transaction for the user's own wallet to send. */
export type TxRequest = { chainId: number; to: Hex; value: string; data: Hex };

export function parseTx(raw: unknown): TxRequest | null {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (!Number.isInteger(r.chainId) || (r.chainId as number) <= 0) return null;
	if (!isAddress(r.to) || !isDigits(r.value) || !isHexData(r.data)) return null;
	return {
		chainId: r.chainId as number,
		to: r.to,
		value: r.value,
		data: r.data,
	};
}

export type AgentView = {
	id: string;
	tokenId: string;
	name: string;
	description: string;
	model: string;
	/** "active" once minted; other values are shown as-is. */
	status: string;
	avatarKind: string | null;
	avatarRef: unknown;
	agentWallet: Hex | null;
	/** wei; null when the chain could not be read */
	balanceWei: string | null;
	createdAt: string;
};

export function parseAgent(raw: unknown): AgentView | null {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (!isText(r.id) || r.id === "" || !isDigits(r.tokenId)) return null;
	if (
		!isText(r.name) ||
		!isText(r.model) ||
		!isText(r.status) ||
		!isText(r.createdAt)
	)
		return null;
	if (r.agentWallet !== null && !isAddress(r.agentWallet)) return null;
	if (r.balanceWei !== null && !isDigits(r.balanceWei)) return null;
	return {
		id: r.id,
		tokenId: r.tokenId,
		name: r.name,
		description: isText(r.description) ? r.description : "",
		model: r.model,
		status: r.status,
		avatarKind: isText(r.avatarKind) ? r.avatarKind : null,
		avatarRef: r.avatarRef ?? null,
		agentWallet: r.agentWallet,
		balanceWei: r.balanceWei,
		createdAt: r.createdAt,
	};
}

export function parseAgentList(json: unknown): AgentView[] | null {
	if (typeof json !== "object" || json === null) return null;
	const list = (json as { agents?: unknown }).agents;
	if (!Array.isArray(list)) return null;
	const out: AgentView[] = [];
	for (const raw of list) {
		const a = parseAgent(raw);
		if (!a) return null;
		out.push(a);
	}
	return out;
}

export type Prepared = {
	draftId: string;
	agentWallet: Hex;
	expiresAt: string;
	mint: TxRequest;
};

export function parsePrepared(json: unknown): Prepared | null {
	if (typeof json !== "object" || json === null) return null;
	const r = json as Record<string, unknown>;
	const mint = parseTx(r.mint);
	if (
		!isText(r.draftId) ||
		r.draftId === "" ||
		!isAddress(r.agentWallet) ||
		!isText(r.expiresAt) ||
		!mint
	) {
		return null;
	}
	return {
		draftId: r.draftId,
		agentWallet: r.agentWallet,
		expiresAt: r.expiresAt,
		mint,
	};
}

export type Confirmed = { agent: AgentView; authorize: TxRequest };

export function parseConfirmed(json: unknown): Confirmed | null {
	if (typeof json !== "object" || json === null) return null;
	const r = json as Record<string, unknown>;
	const agent = parseAgent(r.agent);
	const authorize = parseTx(r.authorize);
	return agent && authorize ? { agent, authorize } : null;
}

/** The face the owner picked in the wizard. */
export type AvatarChoice =
	| { kind: "preset"; id: string }
	| { kind: "dicebear"; seed: string; bg: string }
	| { kind: "upload"; mediaId: string };

export type PolicyInput = {
	perJobCap: string;
	dailyCap: string;
	minJobsCompleted: number;
	maxHireDepth: number;
	evaluatorMode: string;
};

const DIGITS = /^\d+$/;

export function parsePolicy(json: unknown): PolicyInput | null {
	if (typeof json !== "object" || json === null) return null;
	const p = json as Record<string, unknown>;
	if (typeof p.perJobCap !== "string" || !DIGITS.test(p.perJobCap)) return null;
	if (typeof p.dailyCap !== "string" || !DIGITS.test(p.dailyCap)) return null;
	if (
		!Number.isInteger(p.minJobsCompleted) ||
		!Number.isInteger(p.maxHireDepth)
	)
		return null;
	if (typeof p.evaluatorMode !== "string") return null;
	return {
		perJobCap: p.perJobCap,
		dailyCap: p.dailyCap,
		minJobsCompleted: p.minJobsCompleted as number,
		maxHireDepth: p.maxHireDepth as number,
		evaluatorMode: p.evaluatorMode,
	};
}

export type Problem = { code: string; message: string; retryable: boolean };

const KNOWN: Record<string, { message: string; retryable: boolean }> = {
	UNKNOWN_MODEL: {
		message: "That model is not available any more. Pick another one.",
		retryable: false,
	},
	NOT_MINED: {
		message: "The mint is not confirmed yet. Wait a moment, then try again.",
		retryable: true,
	},
	MINT_FAILED: {
		message:
			"The mint transaction failed on chain. Check your balance and try again.",
		retryable: false,
	},
	MINT_NOT_FOUND: {
		message: "That transaction is not an Aeon mint.",
		retryable: false,
	},
	FORBIDDEN: {
		message:
			"That agent was minted to a wallet you have not linked. Link it in Settings first.",
		retryable: false,
	},
	MINT_MISMATCH: {
		message: "That mint came from a different draft. Start the mint again.",
		retryable: false,
	},
	ALREADY_CONFIRMED: {
		message: "This agent has already been created.",
		retryable: false,
	},
	TX_ALREADY_USED: {
		message: "That transaction already created another agent.",
		retryable: false,
	},
	NOT_FOUND: {
		message: "This draft has expired. Start the mint again.",
		retryable: false,
	},
	SERVICE_UNAVAILABLE: {
		message: "Minting is switched off on this server right now.",
		retryable: true,
	},
	WALLET_REQUIRED: {
		message: "Link a wallet before you mint an agent.",
		retryable: false,
	},
	UNAUTHORIZED: {
		message: "You are signed out. Sign in again to continue.",
		retryable: false,
	},
	BAD_RESPONSE: {
		message:
			"Aeon answered in a way the app did not expect. Reload and try again.",
		retryable: true,
	},
};

/** Words for whatever a prepare or confirm call threw. Unknown errors are retryable. */
export function mintProblem(error: unknown): Problem {
	const { code, status } = errorInfo(error);
	if (code) {
		const known = KNOWN[code];
		if (known) return { code, ...known };
		return {
			code,
			message: `Aeon could not finish this step (${code}).`,
			retryable: (status ?? 0) >= 500,
		};
	}
	return {
		code: "NETWORK",
		message: "Could not reach Aeon. Check your connection and try again.",
		retryable: true,
	};
}
