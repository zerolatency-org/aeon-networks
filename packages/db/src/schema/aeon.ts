// packages/db/src/schema/aeon.ts
// Aeon's own tables. Conventions (Backend Blueprint): snake_case, uuid keys,
// timestamptz, lowercase 0x addresses, numeric(78,0) <-> bigint for chain values.
// No column ever holds readable chat, task or result text.
import { sql } from "drizzle-orm";
import {
	bytea,
	check,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

const chainUint = (name: string) =>
	numeric(name, { precision: 78, scale: 0, mode: "bigint" });
const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const agents = pgTable(
	"agents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tokenId: chainUint("token_id").notNull().unique(),
		ownerAddress: text("owner_address").notNull(),
		ownerUserId: text("owner_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		avatarKind: text("avatar_kind", { enum: ["preset", "dicebear", "upload"] })
			.notNull()
			.default("preset"),
		avatarRef: jsonb("avatar_ref")
			.$type<string | { seed: string; bg: string }>()
			.notNull()
			.default("p01"),
		model: text("model").notNull(),
		personaCipher: bytea("persona_cipher"),
		configRootHash: text("config_root_hash"),
		status: text("status", { enum: ["active", "transferred"] })
			.notNull()
			.default("active"),
		mintedTx: text("minted_tx").notNull(),
		mintedBlock: chainUint("minted_block").notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		index("agents_owner_address_idx").on(t.ownerAddress),
		index("agents_owner_user_id_idx").on(t.ownerUserId),
		check(
			"agents_owner_address_lower",
			sql`${t.ownerAddress} ~ '^0x[0-9a-f]{40}$'`,
		),
	],
);

export const agentWallets = pgTable(
	"agent_wallets",
	{
		agentId: uuid("agent_id")
			.primaryKey()
			.references(() => agents.id, { onDelete: "cascade" }),
		address: text("address").notNull().unique(),
		publicKey: text("public_key").notNull(),
		keyCipher: bytea("key_cipher").notNull(),
		keyVersion: integer("key_version").notNull().default(1),
		createdAt: createdAt(),
		rotatedAt: timestamp("rotated_at", { withTimezone: true }),
	},
	(t) => [
		check(
			"agent_wallets_address_lower",
			sql`${t.address} ~ '^0x[0-9a-f]{40}$'`,
		),
	],
);
