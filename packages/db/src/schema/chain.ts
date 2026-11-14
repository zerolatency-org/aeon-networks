import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { agents } from "./aeon";
import { user } from "./auth";

const chainUint = (name: string) =>
	numeric(name, { precision: 78, scale: 0, mode: "bigint" });
const blockNumber = (name: string) => bigint(name, { mode: "bigint" });
const tstz = (name: string) => timestamp(name, { withTimezone: true });
const lowerAddress = (column: unknown) => sql`${column} ~ '^0x[0-9a-f]{40}$'`;

export const indexerCursors = pgTable("indexer_cursors", {
	name: text("name").primaryKey(),
	lastBlock: blockNumber("last_block").notNull(),
	lastBlockHash: text("last_block_hash"),
	updatedAt: tstz("updated_at").defaultNow().notNull(),
});

export const chainEvents = pgTable(
	"chain_events",
	{
		txHash: text("tx_hash").notNull(),
		logIndex: integer("log_index").notNull(),
		blockNumber: blockNumber("block_number").notNull(),
		contract: text("contract", {
			enum: ["nft", "registry", "escrow"],
		}).notNull(),
		eventName: text("event_name").notNull(),
		createdAt: tstz("created_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.txHash, t.logIndex] }),
		index("chain_events_block_idx").on(t.blockNumber),
	],
);

export const listings = pgTable(
	"listings",
	{
		tokenId: chainUint("token_id").primaryKey(),
		listedBy: text("listed_by").notNull(),
		agentWallet: text("agent_wallet").notNull(),
		price: chainUint("price").notNull(),
		active: boolean("active").notNull(),
		profileHash: text("profile_hash").notNull(),
		jobsCompleted: integer("jobs_completed").notNull().default(0),
		jobsDisputed: integer("jobs_disputed").notNull().default(0),
		totalSettled: chainUint("total_settled").notNull().default(0n),
		updatedBlock: blockNumber("updated_block").notNull(),
		updatedAt: tstz("updated_at").defaultNow().notNull(),
	},
	(t) => [
		index("listings_active_price_idx").on(t.active, t.price),
		check("listings_listed_by_lower", lowerAddress(t.listedBy)),
		check("listings_agent_wallet_lower", lowerAddress(t.agentWallet)),
	],
);

export const JOB_STATE_VALUES = [
	"funded",
	"submitted",
	"completed",
	"disputed",
	"declined",
	"refunded",
	"timed_out",
	"split",
	"force_closed",
] as const;

export const jobs = pgTable(
	"jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		chainJobId: chainUint("chain_job_id").notNull().unique(),
		tokenId: chainUint("token_id").notNull(),
		clientAddress: text("client_address").notNull(),
		payeeAddress: text("payee_address").notNull(),
		evaluatorAddress: text("evaluator_address").notNull(),
		amount: chainUint("amount").notNull(),
		state: text("state", { enum: JOB_STATE_VALUES }).notNull(),
		taskHash: text("task_hash").notNull(),
		resultHash: text("result_hash"),
		expiredAt: tstz("expired_at").notNull(),
		acceptWindowS: integer("accept_window_s").notNull(),
		submittedAt: tstz("submitted_at"),
		disputedAt: tstz("disputed_at"),
		settledAt: tstz("settled_at"),
		createTx: text("create_tx").notNull(),
		lastEventBlock: blockNumber("last_event_block").notNull(),
		createdByUserId: text("created_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		clientAgentId: uuid("client_agent_id").references(() => agents.id, {
			onDelete: "set null",
		}),
		hireDepth: integer("hire_depth").notNull().default(0),
		createdAt: tstz("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("jobs_state_expired_idx").on(t.state, t.expiredAt),
		index("jobs_token_state_idx").on(t.tokenId, t.state),
		index("jobs_client_created_idx").on(t.clientAddress, t.createdAt),
		check("jobs_client_lower", lowerAddress(t.clientAddress)),
		check("jobs_payee_lower", lowerAddress(t.payeeAddress)),
		check("jobs_evaluator_lower", lowerAddress(t.evaluatorAddress)),
	],
);

export const revenueEvents = pgTable(
	"revenue_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		source: text("source", {
			enum: ["mint", "listing", "job_fee", "topup"],
		}).notNull(),
		txHash: text("tx_hash").notNull(),
		logIndex: integer("log_index").notNull(),
		amount: chainUint("amount").notNull(),
		payerAddress: text("payer_address").notNull(),
		blockNumber: blockNumber("block_number").notNull(),
		createdAt: tstz("created_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("revenue_events_tx_log_uq").on(t.txHash, t.logIndex)],
);
