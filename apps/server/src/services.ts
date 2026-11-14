import { createAuth, createWalletLinker } from "@aeon/auth";
import { createDb } from "@aeon/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
export const wallets = createWalletLinker(auth, db, ENV);
