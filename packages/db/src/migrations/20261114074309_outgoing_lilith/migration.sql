CREATE TABLE "agent_wallets" (
	"agent_id" uuid PRIMARY KEY,
	"address" text NOT NULL UNIQUE,
	"public_key" text NOT NULL,
	"key_cipher" bytea NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "agent_wallets_address_lower" CHECK ("address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_id" numeric(78,0) NOT NULL UNIQUE,
	"owner_address" text NOT NULL,
	"owner_user_id" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"avatar_kind" text DEFAULT 'preset' NOT NULL,
	"avatar_ref" jsonb DEFAULT '"p01"' NOT NULL,
	"model" text NOT NULL,
	"persona_cipher" bytea,
	"config_root_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"minted_tx" text NOT NULL,
	"minted_block" numeric(78,0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_owner_address_lower" CHECK ("owner_address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "wallet_address" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agents_owner_address_idx" ON "agents" ("owner_address");--> statement-breakpoint
CREATE INDEX "agents_owner_user_id_idx" ON "agents" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "walletAddress_userId_idx" ON "wallet_address" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_address_address_lower_uq" ON "wallet_address" (lower("address"));--> statement-breakpoint
ALTER TABLE "agent_wallets" ADD CONSTRAINT "agent_wallets_agent_id_agents_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_user_id_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "wallet_address" ADD CONSTRAINT "wallet_address_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;