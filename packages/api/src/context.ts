// packages/api/src/context.ts
import type { Session, WalletLinker } from "@aeon/auth";
import type { Deployment } from "@aeon/chain";
import type { SecretBox } from "@aeon/crypto";
import type { Database } from "@aeon/db";
import type { Catalog, RouterConfig } from "@aeon/harness";
import type { PublicClient } from "viem";

/** Chain, secrets and model access. Null when the server runs without them. */
export type AeonServices = {
	client: PublicClient;
	deployment: Deployment;
	box: SecretBox;
	router: RouterConfig;
	catalog: Catalog;
	mailbox?: { maxBytes: number; quotaBytes: number };
};

export type Context = {
	session: Session | null;
	db: Database;
	wallets: WalletLinker;
	aeon: AeonServices | null;
};
