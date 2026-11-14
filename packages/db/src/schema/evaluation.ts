// packages/db/src/schema/evaluation.ts
// P9: verdicts, owner approvals and the archive record. No readable text: a verdict's
// reasons are an envelope for the job's readers, a paused decision is sealed.
import {
	bytea,
	index,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { agents } from "./aeon";
import { user } from "./auth";
import { jobs } from "./chain";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** One verdict per job: the evaluator's decision and the check codes behind it. */
export const jobVerdicts = pgTable("job_verdicts", {
	jobId: uuid("job_id")
		.primaryKey()
		.references(() => jobs.id, { onDelete: "cascade" }),
	evaluatorAddress: text("evaluator_address").notNull(),
	verdict: text("verdict", { enum: ["pass", "fail", "unsure"] }).notNull(),
	/** failed check codes, e.g. ["INTEGRITY"] or ["MISSING_FIELD:risks"] */
	checks: jsonb("checks").$type<string[]>().notNull().default([]),
	score: real("score"),
	/** the model's reasons, sealed in an envelope for the job's readers */
	reasonsCipher: bytea("reasons_cipher"),
	model: text("model"),
	/** complete or dispute transaction, once sent */
	decidedTx: text("decided_tx"),
	createdAt: tstz("created_at").defaultNow().notNull(),
});

/** Something an owner must decide: an unsure verdict (P9) or an over-policy hire (P10). */
export const approvals = pgTable(
	"approvals",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		kind: text("kind", { enum: ["verdict", "hire"] }).notNull(),
		/** who decides */
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		agentId: uuid("agent_id").references(() => agents.id, {
			onDelete: "cascade",
		}),
		jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
		tokenId: text("token_id"),
		amount: text("amount"),
		reason: text("reason"),
		/** the paused request (a hire's parameters), sealed under MASTER_KEY */
		stateCipher: bytea("state_cipher"),
		status: text("status", {
			enum: ["pending", "approved", "rejected", "expired", "done"],
		})
			.notNull()
			.default("pending"),
		requestedAt: tstz("requested_at").defaultNow().notNull(),
		decidedBy: text("decided_by"),
		decidedAt: tstz("decided_at"),
	},
	(t) => [
		index("approvals_user_status_idx").on(t.userId, t.status),
		index("approvals_agent_status_idx").on(t.agentId, t.status),
	],
);

/** A completed job's result, archived into an agent's vault. */
export const jobArchives = pgTable("job_archives", {
	jobId: uuid("job_id")
		.primaryKey()
		.references(() => jobs.id, { onDelete: "cascade" }),
	agentId: uuid("agent_id")
		.notNull()
		.references(() => agents.id, { onDelete: "cascade" }),
	entryRoot: text("entry_root").notNull(),
	manifestRoot: text("manifest_root").notNull(),
	anchorTx: text("anchor_tx").notNull(),
	createdAt: tstz("created_at").defaultNow().notNull(),
});
