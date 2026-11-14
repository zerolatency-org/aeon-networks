CREATE TABLE "job_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage" text NOT NULL,
	"envelope" bytea,
	"og_root_hash" text,
	"payload_hash" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploader_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "job_deliveries_storage_shape" CHECK (("storage" = 'mailbox' and "envelope" is not null) or ("storage" = 'og' and "og_root_hash" is not null) or "deleted_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"job_id" uuid,
	"role" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "job_runs_pkey" PRIMARY KEY("job_id","role")
);
--> statement-breakpoint
CREATE TABLE "listing_profiles" (
	"profile_hash" text PRIMARY KEY,
	"token_id" numeric(78,0) NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags_text" text DEFAULT '' NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "name" || ' ' || "description" || ' ' || "tags_text")) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_deliveries_job_kind_uq" ON "job_deliveries" ("job_id","kind");--> statement-breakpoint
CREATE INDEX "job_deliveries_expires_idx" ON "job_deliveries" ("expires_at");--> statement-breakpoint
CREATE INDEX "job_deliveries_uploader_idx" ON "job_deliveries" ("uploader_address");--> statement-breakpoint
CREATE INDEX "job_runs_status_idx" ON "job_runs" ("role","status");--> statement-breakpoint
CREATE INDEX "listing_profiles_search_idx" ON "listing_profiles" USING gin ("search");--> statement-breakpoint
CREATE INDEX "listing_profiles_tags_idx" ON "listing_profiles" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "listing_profiles_token_idx" ON "listing_profiles" ("token_id");--> statement-breakpoint
ALTER TABLE "job_deliveries" ADD CONSTRAINT "job_deliveries_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;