// packages/db/src/schema/autonomy.ts
// P10: what an agent may spend without asking, and the owner's standing instructions.
import {
	bytea,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { agents } from "./aeon";
import { user } from "./auth";

const wei = (name: string) =>
	numeric(name, { precision: 78, scale: 0, mode: "bigint" });
const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** One policy per agent. No row means the defaults in @aeon/harness (DEFAULT_POLICY). */
export const spendingPolicies = pgTable("spending_policies", {
	agentId: uuid("agent_id")
		.primaryKey()
		.references(() => agents.id, { onDelete: "cascade" }),
	perJobCap: wei("per_job_cap").notNull(),
	dailyCap: wei("daily_cap").notNull(),
	minJobsCompleted: integer("min_jobs_completed").notNull().default(0),
	maxHireDepth: integer("max_hire_depth").notNull().default(1),
	/** who judges the work this agent buys: itself, or the Aeon Verifier */
	evaluatorMode: text("evaluator_mode", {
		enum: ["own_agent", "aeon_verifier"],
	})
		.notNull()
		.default("own_agent"),
	updatedAt: tstz("updated_at").defaultNow().notNull(),
});

/** An instruction the owner leaves for their agent to act on while they are away. */
export const agentTasks = pgTable(
	"agent_tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		agentId: uuid("agent_id")
			.notNull()
			.references(() => agents.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		/** the instruction text, sealed under MASTER_KEY */
		instructionCipher: bytea("instruction_cipher").notNull(),
		status: text("status", { enum: ["queued", "running", "done", "failed"] })
			.notNull()
			.default("queued"),
		attempts: integer("attempts").notNull().default(0),
		lockedUntil: tstz("locked_until"),
		errorCode: text("error_code"),
		/** what the run did: chain job ids hired, approval ids requested */
		outcome: jsonb("outcome")
			.$type<{ hired: string[]; pendingApprovals: string[] }>()
			.notNull()
			.default({ hired: [], pendingApprovals: [] }),
		createdAt: tstz("created_at").defaultNow().notNull(),
		finishedAt: tstz("finished_at"),
	},
	(t) => [index("agent_tasks_status_idx").on(t.status, t.createdAt)],
);
