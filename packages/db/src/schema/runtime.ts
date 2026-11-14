// packages/db/src/schema/runtime.ts
// P6: agent drafts (between prepare and confirm) and per-call usage rows.
// Neither table holds readable text: personas and keys are sealed, chats are never stored.
import { sql } from "drizzle-orm";
import {
	bytea,
	check,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { agents } from "./aeon";
import { user } from "./auth";

const chainUint = (name: string) =>
	numeric(name, { precision: 78, scale: 0, mode: "bigint" });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * POST /agents/prepare creates a draft with a fresh agent wallet; POST /agents/confirm
 * turns it into an agents row once the mint is on chain. confirmed_tx is unique, so one
 * mint can confirm only one draft.
 */
export const agentDrafts = pgTable(
	"agent_drafts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ownerAddress: text("owner_address").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		model: text("model").notNull(),
		personaCipher: bytea("persona_cipher").notNull(),
		personaHash: text("persona_hash").notNull(),
		walletAddress: text("wallet_address").notNull().unique(),
		walletPublicKey: text("wallet_public_key").notNull(),
		walletKeyCipher: bytea("wallet_key_cipher").notNull(),
		keyVersion: integer("key_version").notNull().default(1),
		createdAt: tstz("created_at").defaultNow().notNull(),
		expiresAt: tstz("expires_at").notNull(),
		confirmedTx: text("confirmed_tx").unique(),
		confirmedTokenId: chainUint("confirmed_token_id"),
		confirmedAt: tstz("confirmed_at"),
	},
	(t) => [
		index("agent_drafts_owner_idx").on(t.ownerUserId, t.createdAt),
		check(
			"agent_drafts_owner_lower",
			sql`${t.ownerAddress} ~ '^0x[0-9a-f]{40}$'`,
		),
		check(
			"agent_drafts_wallet_lower",
			sql`${t.walletAddress} ~ '^0x[0-9a-f]{40}$'`,
		),
	],
);

/** One row per model run (a chat turn, later a job or an evaluation). Counts only. */
export const usageEvents = pgTable(
	"usage_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		agentId: uuid("agent_id")
			.notNull()
			.references(() => agents.id, { onDelete: "cascade" }),
		jobId: chainUint("job_id"),
		kind: text("kind", {
			enum: ["chat", "job", "evaluate", "upload", "sandbox"],
		}).notNull(),
		model: text("model").notNull(),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		/** neuron: billed by the Router, or estimated from tokens when no trace came back */
		cost: chainUint("cost").notNull().default(0n),
		traceId: text("trace_id"),
		createdAt: tstz("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("usage_events_user_created_idx").on(t.userId, t.createdAt.desc()),
	],
);
