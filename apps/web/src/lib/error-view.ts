// apps/web/src/lib/error-view.ts
// Pure module for sanitizing and formatting error messages safely.

const SECRET_PATTERNS = [
	/0x[0-9a-fA-F]{64}/, // 32-byte private keys or raw hashes
	/persona/i,
	/cipher/i,
	/secret/i,
	/authorization:\s*bearer/i,
];

function containsSecret(str: string): boolean {
	return SECRET_PATTERNS.some((pattern) => pattern.test(str));
}

export function isNetworkOrRpcError(error: unknown): boolean {
	if (!error || typeof error !== "object" || !("message" in error)) {
		return false;
	}
	const msg = String((error as { message: unknown }).message).toLowerCase();
	return (
		msg.includes("failed to fetch") ||
		msg.includes("networkerror") ||
		msg.includes("network request failed") ||
		msg.includes("rpc") ||
		msg.includes("timeout") ||
		msg.includes("econnrefused") ||
		msg.includes("connection reset")
	);
}

export function isAuthError(error: unknown): boolean {
	if (!error || typeof error !== "object" || !("message" in error)) {
		return false;
	}
	const msg = String((error as { message: unknown }).message).toLowerCase();
	return (
		msg.includes("unauthorized") ||
		msg.includes("401") ||
		msg.includes("session expired") ||
		msg.includes("jwt expired") ||
		msg.includes("not logged in")
	);
}

export function formatErrorHeadline(error: unknown): string {
	if (!error || !(error instanceof Error)) {
		return "An unexpected error occurred";
	}

	const msg = error.message;

	if (containsSecret(msg)) {
		return "An unexpected error occurred";
	}

	const lower = msg.toLowerCase();

	if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
		return "Unable to connect to the network";
	}
	if (lower.includes("timeout") || lower.includes("timed out")) {
		return "Request timed out";
	}
	if (lower.includes("unauthorized") || lower.includes("401")) {
		return "Authentication required";
	}
	if (lower.includes("404") || lower.includes("not found")) {
		return "Resource not found";
	}

	return "An unexpected error occurred";
}

export function formatErrorDetails(error: unknown): string {
	if (isNetworkOrRpcError(error)) {
		return "The 0G network or backend service could not be reached. Please check your internet connection or try again shortly.";
	}
	if (isAuthError(error)) {
		return "Your session may have expired. Please sign in again with your wallet or account.";
	}
	return "Something went wrong while processing your request. Please try reloading the page.";
}
