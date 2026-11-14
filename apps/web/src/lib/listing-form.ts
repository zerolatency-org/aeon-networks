// apps/web/src/lib/listing-form.ts
import { ogText, parseOg } from "./policy-form";
import { ApiError } from "./siwe-api";

/** 0.001 0G default registry minimum price (10^15 wei). */
export const DEFAULT_MIN_PRICE = 10n ** 15n;

export type PriceCheck =
	| { ok: true; wei: bigint }
	| { ok: false; message: string };

export function checkPrice(
	text: string,
	minPriceWei: bigint = DEFAULT_MIN_PRICE,
): PriceCheck {
	const trimmed = text.trim();
	if (trimmed === "") {
		return { ok: false, message: "Enter a price in 0G." };
	}
	const wei = parseOg(trimmed);
	if (wei === null) {
		return { ok: false, message: "Enter a valid price in 0G, like 0.05." };
	}
	if (wei === 0n) {
		return { ok: false, message: "Enter more than zero." };
	}
	if (wei < minPriceWei) {
		return {
			ok: false,
			message: `Price must be at least ${ogText(minPriceWei)} 0G.`,
		};
	}
	return { ok: true, wei };
}

const ERROR_MESSAGES: Record<string, string> = {
	PRICE_TOO_LOW: "Price is below the registry minimum.",
	NOT_MINED: "Transaction is still pending on chain.",
	TX_FAILED: "The listing transaction failed on chain.",
	LISTING_NOT_FOUND: "Listing transaction could not be verified.",
	FORBIDDEN: "You do not own this agent.",
	NOT_FOUND: "Agent or listing not found.",
};

export function priceProblem(err: unknown): string {
	if (!err) return "Could not update listing.";
	if (err instanceof ApiError) {
		return (
			ERROR_MESSAGES[err.code] ?? err.message ?? "Could not update listing."
		);
	}
	if (err instanceof Error) {
		return err.message;
	}
	return "Could not update listing.";
}
