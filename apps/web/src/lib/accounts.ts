// apps/web/src/lib/accounts.ts
// Rules for the linked-accounts screen. No React, no network.
import { errorInfo } from "./retry";

export const SOCIAL_PROVIDERS = [
	{ id: "google", label: "Google" },
	{ id: "github", label: "GitHub" },
] as const;

export type SocialId = (typeof SOCIAL_PROVIDERS)[number]["id"];

/** One row from better-auth's listAccounts. Only the provider matters here. */
export type AccountRow = { providerId: string };

export type ProviderRow = {
	id: SocialId;
	label: string;
	linked: boolean;
	/** False when removing it would leave no way to sign in. */
	canUnlink: boolean;
};

/**
 * How many ways the user can sign in: each linked Google or GitHub account, plus
 * one for having any wallet. Other rows (the wallet's own account row, email) are not counted twice.
 */
export function methodCount(input: {
	accounts: AccountRow[];
	walletCount: number;
}): number {
	const social = new Set(
		input.accounts
			.map((a) => a.providerId)
			.filter((id) => SOCIAL_PROVIDERS.some((p) => p.id === id)),
	);
	return social.size + (input.walletCount > 0 ? 1 : 0);
}

export function providerRows(input: {
	accounts: AccountRow[];
	walletCount: number;
}): ProviderRow[] {
	const total = methodCount(input);
	const linked = new Set(input.accounts.map((a) => a.providerId));
	return SOCIAL_PROVIDERS.map((p) => ({
		id: p.id,
		label: p.label,
		linked: linked.has(p.id),
		canUnlink: linked.has(p.id) && total > 1,
	}));
}

/** Plain words for a failed unlink. The server answers 400 when it is the last method. */
export function unlinkMessage(error: unknown): { title: string; hint: string } {
	if (errorInfo(error).status === 400) {
		return {
			title: "That is your only way to sign in",
			hint: "Link a wallet or another account first, then remove this one.",
		};
	}
	return {
		title: "Could not remove it",
		hint: "Try again. If it keeps happening, reload the page.",
	};
}
