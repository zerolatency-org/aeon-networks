// apps/web/src/lib/use-session.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { orpc } from "./orpc";
import { deriveSession } from "./session";

/** Who is signed in. Re-asks the API when the cache for `me` is invalidated. */
export function useSession() {
	const q = useQuery(orpc.me.queryOptions());
	return deriveSession({
		data: q.data,
		error: q.error,
		isPending: q.isPending,
	});
}
