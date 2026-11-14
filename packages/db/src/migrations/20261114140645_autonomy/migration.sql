CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"agent_id" uuid NOT NULL,
	"user_id" text,
	"instruction_cipher" bytea NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"error_code" text,
	"outcome" jsonb DEFAULT '{"hired":[],"pendingApprovals":[]}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "spending_policies" (
	"agent_id" uuid PRIMARY KEY,
	"per_job_cap" numeric(78,0) NOT NULL,
	"daily_cap" numeric(78,0) NOT NULL,
	"min_jobs_completed" integer DEFAULT 0 NOT NULL,
	"max_hire_depth" integer DEFAULT 1 NOT NULL,
	"evaluator_mode" text DEFAULT 'own_agent' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_tasks_status_idx" ON "agent_tasks" ("status","created_at");--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "spending_policies" ADD CONSTRAINT "spending_policies_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;