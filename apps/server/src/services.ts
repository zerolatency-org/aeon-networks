// apps/server/src/services.ts
import { existsSync } from "node:fs";
import type { AeonServices } from "@aeon/api/context";
import { createAuth, createWalletLinker } from "@aeon/auth";
import { chainFor, loadDeployment } from "@aeon/chain";
import { createSecretBox } from "@aeon/crypto";
import { createDb } from "@aeon/db";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { createMemoryStore, createOgStore, withDeadline } from "@aeon/storage";
import { createPublicClient, type Hex, http, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
export const wallets = createWalletLinker(auth, db, ENV);
/** The Aeon Verifier's key: only the worker signs with it. */
export const verifierKey = ENV.AEON_VERIFIER_PRIVATE_KEY as Hex | undefined;
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
		store: blobStore(),
		verifier: verifierKey ? verifierOf(verifierKey) : undefined,
	};
}

/** The Aeon Verifier's public half, for clients that name it as evaluator. */
function verifierOf(key: Hex) {
	const account = privateKeyToAccount(key);
	return {
		address: account.address.toLowerCase() as Hex,
		publicKey: account.publicKey,
	};
}

/** 0G Storage when STORAGE_PRIVATE_KEY is set; otherwise memory (local runs only). */
function blobStore() {
	if (!ENV.STORAGE_PRIVATE_KEY) {
		console.warn(
			"STORAGE_PRIVATE_KEY not set: big results and archives stay in memory",
		);
		return createMemoryStore();
	}
	return withDeadline(
		createOgStore({
			indexerUrl: ENV.OG_INDEXER_URL,
			rpcUrl: ENV.OG_RPC_URL,
			privateKey: ENV.STORAGE_PRIVATE_KEY,
		}),
		{ put: 120_000, get: 60_000 },
	);
}
