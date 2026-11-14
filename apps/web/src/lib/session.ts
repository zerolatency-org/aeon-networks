// apps/web/src/lib/session.ts
import { shortAddress } from "./format";
import { isUnauthorized } from "./retry";

export type Wallet = { address: `0x${string}`; chainId: number };
export type MeUser = {
	id: string;
	name?: string | null | undefined;
	email?: string | null | undefined;
	image?: string | null | undefined;
};
/** The shape of GET /api/me. */
export type Me = {
	user: MeUser;
	wallets: { address: string; chainId: number; isPrimary: boolean | null }[];
};

export type SessionState =
	| { status: "loading" }
	| { status: "signed-out" }
	| { status: "error" }
	| { status: "needs-wallet"; user: MeUser }
	| { status: "ready"; user: MeUser; wallet: Wallet; wallets: Wallet[] };

function toWallet(w: { address: string; chainId: number }): Wallet {
	return {
		address: w.address.toLowerCase() as `0x${string}`,
		chainId: w.chainId,
	};
}

export function deriveSession(q: {
	data: Me | undefined;
	error: unknown;
	isPending: boolean;
}): SessionState {
	if (q.data) {
		const primary =
			q.data.wallets.find((w) => w.isPrimary === true) ?? q.data.wallets[0];
		if (!primary) return { status: "needs-wallet", user: q.data.user };
		return {
			status: "ready",
			user: q.data.user,
			wallet: toWallet(primary),
			wallets: q.data.wallets.map(toWallet),
		};
	}
	if (q.isPending) return { status: "loading" };
	if (q.error)
		return isUnauthorized(q.error)
			? { status: "signed-out" }
			: { status: "error" };
	return { status: "signed-out" };
}

/** The name to show for a user. Wallet-only users have no name, so the short address stands in. */
export function displayName(user: MeUser, wallet?: Wallet): string {
	const name = user.name?.trim();
	if (name) return name;
	if (wallet) return shortAddress(wallet.address);
	return user.email?.trim() || "Account";
}
