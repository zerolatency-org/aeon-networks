import { cache } from "react";
import { type MarketItem, parsePage } from "./market-api";

const base = () =>
	(
		process.env.API_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		"http://127.0.0.1:9"
	).replace(/\/+$/, "");
export type MarketRead = { items: MarketItem[]; partial: boolean };
export const loadMarket = cache(async (): Promise<MarketRead | null> => {
	try {
		const items: MarketItem[] = [];
		let cursor: string | null = null;
		for (let n = 0; n < 4; n++) {
			const q = new URLSearchParams({ limit: "50" });
			if (cursor) q.set("cursor", cursor);
			const r = await fetch(`${base()}/api/market/agents?${q}`, {
				next: { revalidate: 60 },
			});
			if (!r.ok) return n ? { items, partial: true } : null;
			const p = parsePage(await r.json());
			if (!p) return n ? { items, partial: true } : null;
			items.push(...p.items);
			cursor = p.nextCursor;
			if (!cursor) return { items, partial: false };
		}
		return { items, partial: true };
	} catch {
		return null;
	}
});
