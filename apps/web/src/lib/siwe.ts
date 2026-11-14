// apps/web/src/lib/siwe.ts
import { createSiweMessage } from "viem/siwe";

const TEN_MINUTES = 10 * 60 * 1000;

const STATEMENT = {
	"sign-in": "Sign in to Aeon",
	link: "Link this wallet to your Aeon account",
} as const;

export type SiwePurpose = keyof typeof STATEMENT;

/** The message the wallet signs. `domain` must equal the server's SIWE_DOMAIN (window.location.host). */
export function buildSiweMessage(input: {
	address: `0x${string}`;
	nonce: string;
	chainId: number;
	domain: string;
	origin: string;
	purpose: SiwePurpose;
	now?: Date;
}): string {
	const issuedAt = input.now ?? new Date();
	return createSiweMessage({
		domain: input.domain,
		address: input.address,
		statement: STATEMENT[input.purpose],
		uri: input.origin,
		version: "1",
		chainId: input.chainId,
		nonce: input.nonce,
		issuedAt,
		expirationTime: new Date(issuedAt.getTime() + TEN_MINUTES),
	});
}
