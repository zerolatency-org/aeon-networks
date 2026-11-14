// apps/web/src/lib/jobs-api.ts
import type { TxRequest } from "./agents-parse";
import { ApiError } from "./siwe-api";

export const JOB_STATUSES = [
	"funded",
	"submitted",
	"completed",
	"disputed",
	"declined",
	"refunded",
	"timed_out",
	"split",
	"force_closed",
] as const;

export type JobState = (typeof JOB_STATUSES)[number];

export type JobRole = "client" | "provider" | "evaluator";

export type JobView = {
	jobId: string;
	tokenId: string;
	state: JobState;
	client: string;
	payee: string;
	evaluator: string;
	amount: string;
	taskHash: string;
	resultHash: string | null;
	expiredAt: string;
	acceptWindowS: number;
	submittedAt: string | null;
	settledAt: string | null;
	roles: JobRole[];
};

export type JobDetailView = JobView & {
	deliveries: ("task" | "result")[];
	providerRun: {
		status: string;
		errorCode: string | null;
	} | null;
};

export type PreparedJob = {
	chainId: number;
	escrow: string;
	tokenId: string;
	client: string;
	payee: string;
	evaluator: string;
	provider: string;
	amount: string;
	expiredAt: string;
	acceptWindowS: number;
	tx: TxRequest;
};

export type JobDelivery = {
	kind: "task" | "result";
	storage: string;
	payloadHash: string;
	size: number;
	ogRootHash: string | null;
	envelope: unknown;
};

export type JobVerdict = {
	verdict: string;
	checks: unknown;
	score: number | null;
	model: string;
	decidedTx: string | null;
	reasons: unknown;
	createdAt: string;
};

export type JobAction =
	| "complete"
	| "dispute"
	| "decline"
	| "claimRefund"
	| "claimTimeout"
	| "forceClose";

const digits = (v: unknown): v is string =>
	typeof v === "string" && /^\d{1,40}$/.test(v);

export function parseJobView(raw: unknown): JobView | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (
		!digits(r.jobId) ||
		!digits(r.tokenId) ||
		!digits(r.amount) ||
		typeof r.state !== "string" ||
		!JOB_STATUSES.includes(r.state as JobState) ||
		typeof r.client !== "string" ||
		typeof r.payee !== "string" ||
		typeof r.evaluator !== "string" ||
		typeof r.taskHash !== "string" ||
		typeof r.expiredAt !== "string" ||
		typeof r.acceptWindowS !== "number" ||
		!Array.isArray(r.roles)
	) {
		return null;
	}

	return {
		jobId: r.jobId,
		tokenId: r.tokenId,
		state: r.state as JobState,
		client: r.client,
		payee: r.payee,
		evaluator: r.evaluator,
		amount: r.amount,
		taskHash: r.taskHash,
		resultHash: typeof r.resultHash === "string" ? r.resultHash : null,
		expiredAt: r.expiredAt,
		acceptWindowS: r.acceptWindowS,
		submittedAt: typeof r.submittedAt === "string" ? r.submittedAt : null,
		settledAt: typeof r.settledAt === "string" ? r.settledAt : null,
		roles: r.roles as JobRole[],
	};
}

export function parseJobListResponse(raw: unknown): { jobs: JobView[] } | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!Array.isArray(r.jobs)) return null;
	const parsed = r.jobs.map(parseJobView);
	if (parsed.some((p) => p === null)) return null;
	return { jobs: parsed as JobView[] };
}

export function parseJobDetailResponse(raw: unknown): JobDetailView | null {
	const base = parseJobView(raw);
	if (!base) return null;
	const r = raw as Record<string, unknown>;
	const deliveries = Array.isArray(r.deliveries)
		? (r.deliveries as ("task" | "result")[])
		: [];
	let providerRun = null;
	if (r.providerRun && typeof r.providerRun === "object") {
		const pr = r.providerRun as Record<string, unknown>;
		providerRun = {
			status: String(pr.status ?? "unknown"),
			errorCode: pr.errorCode ? String(pr.errorCode) : null,
		};
	}
	return {
		...base,
		deliveries,
		providerRun,
	};
}

const ERROR_WORDS: Record<string, string> = {
	AMOUNT_TOO_LOW: "Amount is below the minimum required for this agent.",
	BAD_EXPIRY: "Invalid expiration time specified.",
	BAD_WINDOW: "Acceptance window is outside allowed bounds.",
	CLIENT_IS_PAYEE: "You cannot hire your own agent.",
	BAD_EVALUATOR: "The provider cannot evaluate their own deliverable.",
	FORBIDDEN: "You do not have permission to act on this job.",
	NOT_FOUND: "Job or agent listing not found.",
	ALREADY_DELIVERED: "Task has already been delivered for this job.",
	JOB_NOT_FUNDED: "Job has not been funded on chain yet.",
	HASH_MISMATCH: "Payload hash does not match the on-chain task hash.",
	QUOTA_EXCEEDED: "Delivery mailbox quota exceeded. Try again later.",
	NOT_SUBMITTED: "Deliverable must be submitted before evaluation.",
};

export function jobErrorWords(code: string): string {
	return ERROR_WORDS[code] || "The job operation could not be completed.";
}

export async function fetchJobsList(
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ jobs: JobView[] }> {
	const res = await fetchImpl("/api/jobs", {
		credentials: "include",
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "JOBS_LIST_FAILED", res.status);
	}
	const json = await res.json();
	const parsed = parseJobListResponse(json);
	if (!parsed) throw new ApiError("MALFORMED_JOBS_LIST", 500);
	return parsed;
}

export async function fetchJobDetail(
	jobId: string,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<JobDetailView> {
	const res = await fetchImpl(`/api/jobs/${jobId}`, {
		credentials: "include",
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "JOB_DETAIL_FAILED", res.status);
	}
	const json = await res.json();
	const parsed = parseJobDetailResponse(json);
	if (!parsed) throw new ApiError("MALFORMED_JOB_DETAIL", 500);
	return parsed;
}

export async function prepareJob(
	input: {
		tokenId: string;
		taskHash: string;
		amount?: string;
		expiresInS?: number;
		acceptWindowS?: number;
		evaluator?: string;
	},
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<PreparedJob> {
	const res = await fetchImpl("/api/jobs/prepare", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "PREPARE_JOB_FAILED", res.status);
	}
	return res.json();
}

export async function confirmJob(
	txHash: string,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ job: JobView; providerQueued: boolean }> {
	const res = await fetchImpl("/api/jobs/confirm", {
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
}

export async function deliverJobTask(
	jobId: string,
	envelope: unknown,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ jobId: string; size: number; expiresAt: string }> {
	const res = await fetchImpl(`/api/jobs/${jobId}/delivery/task`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ jobId, envelope }),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "DELIVER_TASK_FAILED", res.status);
	}
	return res.json();
}

export async function prepareJobAction(
	jobId: string,
	action: JobAction,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ tx: TxRequest }> {
	const res = await fetchImpl(`/api/jobs/${jobId}/action/prepare`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ jobId, action }),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "ACTION_PREPARE_FAILED", res.status);
	}
	return res.json();
}

export async function fetchJobDelivery(
	jobId: string,
	kind: "task" | "result",
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<JobDelivery> {
	const res = await fetchImpl(`/api/jobs/${jobId}/delivery/${kind}`, {
		credentials: "include",
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "GET_DELIVERY_FAILED", res.status);
	}
	return res.json();
}

export async function fetchJobVerdict(
	jobId: string,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<JobVerdict> {
	const res = await fetchImpl(`/api/jobs/${jobId}/verdict`, {
		credentials: "include",
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "GET_VERDICT_FAILED", res.status);
	}
	return res.json();
}

export async function triggerEvaluate(
	jobId: string,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ queued: boolean }> {
	const res = await fetchImpl(`/api/jobs/${jobId}/evaluate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ jobId }),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { code?: string };
		throw new ApiError(body.code || "TRIGGER_EVALUATE_FAILED", res.status);
	}
	return res.json();
}
