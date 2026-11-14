import type { Session } from "@aeon/auth";
import type { Database } from "@aeon/db";

export type Context = {
	session: Session | null;
	db: Database;
};
