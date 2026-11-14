import { createApp } from "./app";
import { ENV } from "./env.server";
import { auth, db, wallets } from "./services";

const app = createApp({
	db,
	auth,
	wallets,
	corsOrigin: ENV.CORS_ORIGIN,
	version: process.env.APP_VERSION ?? "0.0.0-dev",
});

export default app;
