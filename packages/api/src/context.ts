// packages/api/src/context.ts
import type { Session, WalletLinker } from "@aeon/auth";
import type { Deployment } from "@aeon/chain";
import type { SecretBox } from "@aeon/crypto";
import type { Database } from "@aeon/db";
import type { Catalog, RouterConfig } from "@aeon/harness";
import type { BlobStore } from "@aeon/storage";
import type { PublicClient } from "viem";

/** Chain, secrets and model access. Null when the server runs without them. */
export type AeonServices = {
	client: PublicClient;
	deployment: Deployment;
	box: SecretBox;
	router: RouterConfig;
	catalog: Catalog;
	/** Mailbox limits in bytes (defaults: 1 MiB per envelope, 16 MiB live per user). */
	mailbox?: { maxBytes: number; quotaBytes: number };
	/** 0G Storage (or a memory store in tests): vault uploads and big results */
	store?: BlobStore;
	/** the Aeon Verifier: a neutral evaluator a buyer can name instead of an agent */
	verifier?: { address: `0x${string}`; publicKey: `0x${string}` };
};

export type Context = {
	session: Session | null;
	db: Database;
	wallets: WalletLinker;
	aeon: AeonServices | null;
};
