// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export type Provider = "google" | "github";

/** Sends the browser to Google or GitHub, then back to `callbackURL` (a path on this site). */
export function signInWithProvider(provider: Provider, callbackURL: string) {
	return authClient.signIn.social({ provider, callbackURL });
}

/** Same round trip, but adds the provider to the account that is already signed in. */
export function linkProvider(provider: Provider, callbackURL: string) {
	return authClient.linkSocial({ provider, callbackURL });
}

export function listAccounts() {
	return authClient.listAccounts();
}

/** The server refuses (400) when this is the user's last way to sign in. */
export async function unlinkProvider(provider: Provider) {
	const accounts = await authClient.listAccounts();
	const account = accounts.data?.find((item) => item.providerId === provider);
	if (!account) throw new Error("Account is not linked");
	return authClient.unlinkAccount({ accountId: account.id });
}

export function signOut() {
	return authClient.signOut();
}
