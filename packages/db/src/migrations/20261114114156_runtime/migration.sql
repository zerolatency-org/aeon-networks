CREATE TABLE "agent_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_user_id" text NOT NULL,
	"owner_address" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"persona_cipher" bytea NOT NULL,
	"persona_hash" text NOT NULL,
	"wallet_address" text NOT NULL UNIQUE,
	"wallet_public_key" text NOT NULL,
	"wallet_key_cipher" bytea NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_tx" text UNIQUE,
	"confirmed_token_id" numeric(78,0),
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "agent_drafts_owner_lower" CHECK ("owner_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "agent_drafts_wallet_lower" CHECK ("wallet_address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text,
	"agent_id" uuid NOT NULL,
	"job_id" numeric(78,0),
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(78,0) DEFAULT '0' NOT NULL,
	"trace_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_drafts_owner_idx" ON "agent_drafts" ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "agent_drafts" ADD CONSTRAINT "agent_drafts_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;