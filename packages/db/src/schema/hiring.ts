// packages/db/src/schema/hiring.ts
// P8: the encrypted mailbox and the provider work queue. Envelopes are ciphertext the
// server cannot read; nothing here holds task or result text.
import { sql } from "drizzle-orm";
import {
	bytea,
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { jobs } from "./chain";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** One task and at most one result per job. The envelope bytes go once the job is done with. */
export const jobDeliveries = pgTable(
	"job_deliveries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		jobId: uuid("job_id")
			.notNull()
			.references(() => jobs.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: ["task", "result"] }).notNull(),
		storage: text("storage", { enum: ["mailbox", "og"] }).notNull(),
		/** serialized envelope (ciphertext + wrapped keys); null when stored on 0G */
		envelope: bytea("envelope"),
		ogRootHash: text("og_root_hash"),
		/** keccak256 of the serialized envelope: the job's task_hash or result_hash */
		payloadHash: text("payload_hash").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		uploaderAddress: text("uploader_address").notNull(),
		createdAt: tstz("created_at").defaultNow().notNull(),
		expiresAt: tstz("expires_at").notNull(),
		deletedAt: tstz("deleted_at"),
	},
	(t) => [
		uniqueIndex("job_deliveries_job_kind_uq").on(t.jobId, t.kind),
		index("job_deliveries_expires_idx").on(t.expiresAt),
		index("job_deliveries_uploader_idx").on(t.uploaderAddress),
		check(
			"job_deliveries_storage_shape",
			sql`(${t.storage} = 'mailbox' and ${t.envelope} is not null) or (${t.storage} = 'og' and ${t.ogRootHash} is not null) or ${t.deletedAt} is not null`,
		),
	],
);

export const RUN_STATUS_VALUES = [
	"queued",
	"running",
	"delivered",
	"submitted",
	"decided",
	"failed",
] as const;

/** Work the worker owes on a job. Claimed with FOR UPDATE SKIP LOCKED. */
export const jobRuns = pgTable(
	"job_runs",
	{
		jobId: uuid("job_id")
			.notNull()
			.references(() => jobs.id, { onDelete: "cascade" }),
		role: text("role", { enum: ["provider", "evaluator"] }).notNull(),
		status: text("status", { enum: RUN_STATUS_VALUES })
			.notNull()
			.default("queued"),
		attempts: integer("attempts").notNull().default(0),
		lockedBy: text("locked_by"),
		lockedUntil: tstz("locked_until"),
		errorCode: text("error_code"),
		createdAt: tstz("created_at").defaultNow().notNull(),
		startedAt: tstz("started_at"),
		finishedAt: tstz("finished_at"),
	},
	(t) => [
		primaryKey({ columns: [t.jobId, t.role] }),
		index("job_runs_status_idx").on(t.role, t.status),
	],
);
