// apps/web/src/lib/login-flow.ts
import type { SessionState } from "./session";

export type LoginStep =
	| "checking"
	| "unavailable"
	| "choose"
	| "connect"
	| "switch"
	| "sign"
	| "done";

/** What the login card shows, from the session and the wallet. */
export function loginStep(input: {
	session: SessionState["status"];
	connected: boolean;
	rightChain: boolean;
}): LoginStep {
	switch (input.session) {
		case "loading":
			return "checking";
		case "error":
			return "unavailable";
		case "ready":
			return "done";
		case "signed-out":
		case "needs-wallet": {
			if (!input.connected)
				return input.session === "signed-out" ? "choose" : "connect";
			return input.rightChain ? "sign" : "switch";
		}
	}
}

/** Signing in with a wallet creates a session; a signed-in user without a wallet links one. */
export function signPurpose(
	session: SessionState["status"],
): "sign-in" | "link" {
	return session === "needs-wallet" ? "link" : "sign-in";
}
