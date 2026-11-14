// apps/web/src/lib/query-client.ts
import { QueryCache, QueryClient } from "@tanstack/react-query";

import { shouldRetry } from "./retry";
import { isWalletRequired, loginUrl } from "./route-guard";

const KEY = "aeon:link-redirect";
let leaving = false;

/** A wallet-only call was refused, so the wallet is gone. Go to the link step, once. */
function sendToLink(): void {
	if (leaving || typeof window === "undefined") return;
	try {
		if (Date.now() - Number(sessionStorage.getItem(KEY)) < 10_000) return;
		sessionStorage.setItem(KEY, String(Date.now()));
	} catch {
		// Storage can be blocked. The in-memory flag below still stops repeats on this page.
	}
	leaving = true;
	window.location.assign(
		loginUrl(`${window.location.pathname}${window.location.search}`),
	);
}

export function makeQueryClient(
	onWalletRequired: () => void = sendToLink,
): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				if (isWalletRequired(error)) onWalletRequired();
			},
		}),
		defaultOptions: {
			queries: {
				retry: shouldRetry,
				staleTime: 30_000,
				refetchOnWindowFocus: false,
			},
		},
	});
}
