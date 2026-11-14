// Builds the Hono app from its dependencies so tests can create it with a test
// database and auth instance, and call routes in-process with app.request().
import { appRouter } from "@aeon/api/routers/index";
import type { Auth, WalletLinker } from "@aeon/auth";
import type { Database } from "@aeon/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export type AppDeps = {
	db: Database;
	auth: Auth;
	wallets: WalletLinker;
	corsOrigin: string;
	version: string;
	logRequests?: boolean;
};

export function createApp({
	db,
	auth,
	wallets,
	corsOrigin,
	version,
	logRequests = true,
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

	const apiHandler = new OpenAPIHandler(appRouter, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
			}),
		],
		interceptors: [onError((error) => console.error(error))],
	});
	const rpcHandler = new RPCHandler(appRouter, {
		interceptors: [onError((error) => console.error(error))],
	});

	app.use("/*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		const context = { db, session, wallets };

		const rpc = await rpcHandler.handle(c.req.raw, { prefix: "/rpc", context });
		if (rpc.matched) return c.newResponse(rpc.response.body, rpc.response);

		const api = await apiHandler.handle(c.req.raw, { prefix: "/api", context });
		if (api.matched) return c.newResponse(api.response.body, api.response);

		await next();
	});

	app.get("/", (c) => c.text("OK"));

	return app;
}
