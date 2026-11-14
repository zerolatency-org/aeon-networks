// apps/web/src/lib/retry.ts
// Reads the code and HTTP status off whatever an API call threw (an oRPC error,
// our own ApiError, or anything else) without importing either library.
export type ErrorInfo = { code?: string; status?: number };

export function errorInfo(error: unknown): ErrorInfo {
	if (typeof error !== "object" || error === null) return {};
	const e = error as { code?: unknown; status?: unknown };
	return {
		...(typeof e.code === "string" ? { code: e.code } : {}),
		...(typeof e.status === "number" ? { status: e.status } : {}),
	};
}

export function isUnauthorized(error: unknown): boolean {
	const { code, status } = errorInfo(error);
	return code === "UNAUTHORIZED" || status === 401;
}

const NO_RETRY = new Set(["UNAUTHORIZED", "FORBIDDEN", "WALLET_REQUIRED"]);

/** TanStack Query `retry`: never retry an answer that will not change, otherwise twice. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
	const { code, status } = errorInfo(error);
	if ((code && NO_RETRY.has(code)) || status === 401 || status === 403)
		return false;
	return failureCount < 2;
}
