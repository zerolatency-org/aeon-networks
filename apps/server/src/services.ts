// apps/server/src/services.ts
import { existsSync } from "node:fs";
import type { AeonServices } from "@aeon/api/context";
import { createAuth, createWalletLinker } from "@aeon/auth";
import { chainFor, loadDeployment } from "@aeon/chain";
import { createSecretBox } from "@aeon/crypto";
import { createDb } from "@aeon/db";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { createPublicClient, http, type PublicClient } from "viem";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
export const wallets = createWalletLinker(auth, db, ENV);
export const aeon = loadAeonServices();

function loadAeonServices(): AeonServices | null {
	if (
		!ENV.MASTER_KEY ||
		!ENV.ROUTER_API_KEY ||
		!existsSync(ENV.DEPLOYMENT_FILE)
	) {
		console.warn(
			"agent routes off: set MASTER_KEY and ROUTER_API_KEY, and deploy so DEPLOYMENT_FILE exists",
		);
		return null;
	}
	const deployment = loadDeployment(ENV.DEPLOYMENT_FILE);
	return {
		client: createPublicClient({
			chain: chainFor(deployment.chainId, ENV.OG_RPC_URL),
			transport: http(ENV.OG_RPC_URL),
		}) as PublicClient,
		deployment,
		box: createSecretBox(ENV.MASTER_KEY),
		router: { baseURL: ENV.ROUTER_BASE_URL, apiKey: ENV.ROUTER_API_KEY },
		catalog: DEFAULT_CATALOG,
		mailbox: {
			maxBytes: ENV.MAILBOX_MAX_BYTES,
			quotaBytes: ENV.MAILBOX_QUOTA_BYTES,
		},
	};
}
