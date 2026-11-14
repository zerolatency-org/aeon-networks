// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type Provider = "google" | "github";

/** Sends the browser to Google or GitHub, then back to `callbackURL` (a path on this site). */
export function signInWithProvider(provider: Provider, callbackURL: string) {
	return authClient.signIn.social({ provider, callbackURL });
}

export function signOut() {
	return authClient.signOut();
}
