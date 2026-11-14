// apps/web/src/lib/orpc.ts
import type { AppRouterClient } from "@aeon/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

// Same origin as the page, so the session cookie goes along. /rpc is forwarded by next.config.ts.
const link = new RPCLink({
	url: () => `${window.location.origin}/rpc`,
});

export const client: AppRouterClient = createORPCClient(link);

/** Typed query and mutation options for TanStack Query: orpc.me.queryOptions(). */
export const orpc = createTanstackQueryUtils(client);
