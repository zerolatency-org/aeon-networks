CREATE TABLE "chain_events" (
	"tx_hash" text,
	"log_index" integer,
	"block_number" bigint NOT NULL,
	"contract" text NOT NULL,
	"event_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_events_pkey" PRIMARY KEY("tx_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "indexer_cursors" (
	"name" text PRIMARY KEY,
	"last_block" bigint NOT NULL,
	"last_block_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"chain_job_id" numeric(78,0) NOT NULL UNIQUE,
	"token_id" numeric(78,0) NOT NULL,
	"client_address" text NOT NULL,
	"payee_address" text NOT NULL,
	"evaluator_address" text NOT NULL,
	"amount" numeric(78,0) NOT NULL,
	"state" text NOT NULL,
	"task_hash" text NOT NULL,
	"result_hash" text,
	"expired_at" timestamp with time zone NOT NULL,
	"accept_window_s" integer NOT NULL,
	"submitted_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"create_tx" text NOT NULL,
	"last_event_block" bigint NOT NULL,
	"created_by_user_id" text,
	"client_agent_id" uuid,
	"hire_depth" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_client_lower" CHECK ("client_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "jobs_payee_lower" CHECK ("payee_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "jobs_evaluator_lower" CHECK ("evaluator_address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"token_id" numeric(78,0) PRIMARY KEY,
	"listed_by" text NOT NULL,
	"agent_wallet" text NOT NULL,
	"price" numeric(78,0) NOT NULL,
	"active" boolean NOT NULL,
	"profile_hash" text NOT NULL,
	"jobs_completed" integer DEFAULT 0 NOT NULL,
	"jobs_disputed" integer DEFAULT 0 NOT NULL,
	"total_settled" numeric(78,0) DEFAULT '0' NOT NULL,
	"updated_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_listed_by_lower" CHECK ("listed_by" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "listings_agent_wallet_lower" CHECK ("agent_wallet" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"amount" numeric(78,0) NOT NULL,
	"payer_address" text NOT NULL,
	"block_number" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chain_events_block_idx" ON "chain_events" ("block_number");--> statement-breakpoint
CREATE INDEX "jobs_state_expired_idx" ON "jobs" ("state","expired_at");--> statement-breakpoint
CREATE INDEX "jobs_token_state_idx" ON "jobs" ("token_id","state");--> statement-breakpoint
CREATE INDEX "jobs_client_created_idx" ON "jobs" ("client_address","created_at");--> statement-breakpoint
CREATE INDEX "listings_active_price_idx" ON "listings" ("active","price");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_events_tx_log_uq" ON "revenue_events" ("tx_hash","log_index");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_agent_id_agents_id_fkey" FOREIGN KEY ("client_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL;