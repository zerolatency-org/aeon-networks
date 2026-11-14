// apps/server/src/app.ts
// Builds the Hono app from its dependencies so tests can create it with a test
// database and auth instance, and call routes in-process with app.request().

import type { AeonServices } from "@aeon/api/context";
import { appRouter } from "@aeon/api/routers/index";
import type { Auth, WalletLinker } from "@aeon/auth";
import type { Database } from "@aeon/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { chatHandler } from "./chat";

export type AppDeps = {
	db: Database;
	auth: Auth;
	wallets: WalletLinker;
	corsOrigin: string;
	version: string;
	logRequests?: boolean;
	/** Chain, MASTER_KEY and Router. Without them the agent routes answer 503. */
	aeon?: AeonServices | null;
};

export function createApp({
	db,
	auth,
	wallets,
	corsOrigin,
	version,
	logRequests = true,
	aeon = null,
}: AppDeps) {
	const app = new Hono();

	if (logRequests) app.use(logger());
	app.use(
		"/*",
		cors({
			origin: corsOrigin,
			allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	);

	app.get("/health", async (c) => {
		const dbOk = await db
			.execute(sql`select 1`)
			.then(() => true)
			.catch(() => false);
		return c.json(
			{ status: dbOk ? "ok" : "degraded", version, db: dbOk },
			dbOk ? 200 : 503,
		);
	});

	app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
	app.post("/api/agents/:id/chat", chatHandler({ db, auth, aeon }));

	const apiHandler = new OpenAPIHandler(appRouter, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
		interceptors: [onError(logServerError)],
	});
	const rpcHandler = new RPCHandler(appRouter, {
		interceptors: [onError(logServerError)],
	});

	app.use("/*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		const context = { db, session, wallets, aeon };

		const rpc = await rpcHandler.handle(c.req.raw, { prefix: "/rpc", context });
		if (rpc.matched) return c.newResponse(rpc.response.body, rpc.response);

		// REST routes live under /api (e.g. GET /api/me); docs at GET /api
		const api = await apiHandler.handle(c.req.raw, { prefix: "/api", context });
		if (api.matched) return c.newResponse(api.response.body, api.response);

		await next();
	});

	app.get("/", (c) => c.text("OK"));

	return app;
}

/** Expected 4xx answers (404, 409, ...) are not worth a stack trace; real failures are. */
function logServerError(error: unknown) {
	if (error instanceof ORPCError && error.status < 500) return;
	console.error(error);
}
