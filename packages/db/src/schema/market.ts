// packages/db/src/schema/market.ts
// P7: the public profile behind a listing. The chain stores only its keccak256 hash
// (listings.profile_hash); the words live here, keyed by that hash, so a re-index of
// the chain never loses them and an updated profile simply points at a new row.
import { sql } from "drizzle-orm";
import {
	customType,
	index,
	numeric,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
	dataType: () => "tsvector",
});

export const listingProfiles = pgTable(
	"listing_profiles",
	{
		profileHash: text("profile_hash").primaryKey(),
		tokenId: numeric("token_id", {
			precision: 78,
			scale: 0,
			mode: "bigint",
		}).notNull(),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		/** tags joined by spaces, so the search vector can include them */
		tagsText: text("tags_text").notNull().default(""),
		search: tsvector("search").generatedAlwaysAs(
			sql`to_tsvector('simple', "name" || ' ' || "description" || ' ' || "tags_text")`,
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		index("listing_profiles_search_idx").using("gin", t.search),
		index("listing_profiles_tags_idx").using("gin", t.tags),
		index("listing_profiles_token_idx").on(t.tokenId),
	],
);
