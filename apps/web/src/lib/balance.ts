// apps/web/src/lib/balance.ts
import { formatOg } from "./format";

export type BalanceView =
	| { kind: "loading" }
	| { kind: "error"; text: string }
	| { kind: "wrong-network"; text: string }
	| { kind: "ok"; text: string };

/** What the balance pill shows. A wrong network wins, so the user is nudged to switch before acting. */
export function balanceView(input: {
	wrongNetwork: boolean;
	isPending: boolean;
	isError: boolean;
	value: bigint | undefined;
}): BalanceView {
	if (input.wrongNetwork)
		return { kind: "wrong-network", text: "Wrong network" };
	if (input.isError) return { kind: "error", text: "Balance unavailable" };
	if (input.isPending || input.value === undefined) return { kind: "loading" };
	return { kind: "ok", text: `${formatOg(input.value)} 0G` };
}

export type MenuRow = {
	id: string;
	label: string;
	value: string;
	live: boolean;
};

/**
 * The rows in the pill's dropdown. Credits and agent wallets are placeholders until
 * billing and agent wallets exist, so they say so instead of showing a made-up number.
 */
export function menuRows(wallet: { balanceText: string }): MenuRow[] {
	return [
		{ id: "wallet", label: "Wallet", value: wallet.balanceText, live: true },
		{ id: "credits", label: "Credits", value: "Coming soon", live: false },
		{
			id: "agent-wallets",
			label: "Agent wallets",
			value: "Coming soon",
			live: false,
		},
	];
}
