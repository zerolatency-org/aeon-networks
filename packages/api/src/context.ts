import type { Session, WalletLinker } from "@aeon/auth";
import type { Database } from "@aeon/db";

export type Context = {
	session: Session | null;
	db: Database;
	wallets: WalletLinker;
};
