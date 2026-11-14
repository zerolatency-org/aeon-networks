CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" text NOT NULL,
	"user_id" text,
	"agent_id" uuid,
	"job_id" uuid,
	"token_id" text,
	"amount" text,
	"reason" text,
	"state_cipher" bytea,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_archives" (
	"job_id" uuid PRIMARY KEY,
	"agent_id" uuid NOT NULL,
	"entry_root" text NOT NULL,
	"manifest_root" text NOT NULL,
	"anchor_tx" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_verdicts" (
	"job_id" uuid PRIMARY KEY,
	"evaluator_address" text NOT NULL,
	"verdict" text NOT NULL,
	"checks" jsonb DEFAULT '[]' NOT NULL,
	"score" real,
	"reasons_cipher" bytea,
	"model" text,
	"decided_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "approvals_user_status_idx" ON "approvals" ("user_id","status");--> statement-breakpoint
CREATE INDEX "approvals_agent_status_idx" ON "approvals" ("agent_id","status");--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_archives" ADD CONSTRAINT "job_archives_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_archives" ADD CONSTRAINT "job_archives_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_verdicts" ADD CONSTRAINT "job_verdicts_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;