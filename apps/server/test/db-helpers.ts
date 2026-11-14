// apps/server/test/db-helpers.ts
// Gives a test file an empty, freshly migrated aeon_test database.
// Needs Postgres (bun run db:start) and the aeon_test database (see the guide).

import { fileURLToPath } from "node:url";
import { createDb } from "@aeon/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export const TEST_DATABASE_URL =
	process.env.TEST_DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/aeon_test";

const MIGRATIONS = fileURLToPath(
	new URL("../../../packages/db/src/migrations", import.meta.url),
);

export async function setupTestDb() {
	const db = createDb({ DATABASE_URL: TEST_DATABASE_URL });
	await db.execute(sql`drop schema if exists drizzle cascade`);
	await db.execute(sql`drop schema if exists public cascade`);
	await db.execute(sql`create schema public`);
	await migrate(db, { migrationsFolder: MIGRATIONS });
	return { db, close: () => db.$client.end() };
}
