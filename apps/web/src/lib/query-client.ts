// apps/web/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

import { shouldRetry } from "./retry";

export function makeQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: shouldRetry,
				staleTime: 30_000,
				refetchOnWindowFocus: false,
			},
		},
	});
}
