// apps/web/src/lib/route-guard.ts
// Who may open which page. One table, one decision function, no React.
import { errorInfo } from "./retry";
import type { SessionState } from "./session";

export type Access = "public" | "session" | "wallet";

// Anything not listed needs a signed-in user with a linked wallet, so a new page
// is protected until someone decides otherwise.
const PUBLIC = ["/", "/login", "/lab"];
const SESSION_ONLY = ["/settings"];

function matches(path: string, base: string): boolean {
	return path === base || (base !== "/" && path.startsWith(`${base}/`));
}

export function routeAccess(pathname: string): Access {
	const path = pathname.split(/[?#]/)[0] || "/";
	if (PUBLIC.some((base) => matches(path, base))) return "public";
	if (SESSION_ONLY.some((base) => matches(path, base))) return "session";
	return "wallet";
}

export function loginUrl(next: string): string {
	return `/login?next=${encodeURIComponent(next)}`;
}

export type GuardDecision =
	| { action: "allow" }
	| { action: "wait" }
	| { action: "unavailable" }
	| { action: "redirect"; to: string };

export function guardDecision(input: {
	access: Access;
	session: SessionState["status"];
	/** The page being opened, with its query, so login can return to it. */
	next: string;
}): GuardDecision {
	if (input.access === "public") return { action: "allow" };
	switch (input.session) {
		case "loading":
			return { action: "wait" };
		case "error":
			return { action: "unavailable" };
		case "signed-out":
			return { action: "redirect", to: loginUrl(input.next) };
		case "needs-wallet":
			return input.access === "session"
				? { action: "allow" }
				: { action: "redirect", to: loginUrl(input.next) };
		case "ready":
			return { action: "allow" };
	}
}

/** The API refused a wallet-only call because no wallet is linked (403 WALLET_REQUIRED). */
export function isWalletRequired(error: unknown): boolean {
	return errorInfo(error).code === "WALLET_REQUIRED";
}
