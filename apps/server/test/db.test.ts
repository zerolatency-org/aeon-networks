// apps/server/test/db.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import { setupTestDb } from "./db-helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
beforeAll(async () => {
	t = await setupTestDb();
});
afterAll(() => t?.close());

describe("migrations", () => {
	test("apply to an empty database and create every table", async () => {
		const rows = await t.db.execute<{ table_name: string }>(
			sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
		);
		expect(rows.rows.map((r) => r.table_name)).toEqual([
			"account",
			"agent_wallets",
			"agents",
			"session",
			"user",
			"verification",
			"wallet_address",
		]);
	});

	test("wallet addresses are unique regardless of letter case", async () => {
		await t.db.execute(
			sql`insert into "user" (id, name, email) values ('u1','a','a@x.io'), ('u2','b','b@x.io')`,
		);
		await t.db.execute(
			sql`insert into wallet_address (id, user_id, address, chain_id, created_at) values ('w1','u1','0xAbCdEf0000000000000000000000000000000001',16602, now())`,
		);
		const dup = t.db
			.execute(
				sql`insert into wallet_address (id, user_id, address, chain_id, created_at) values ('w2','u2','0xabcdef0000000000000000000000000000000001',16602, now())`,
			)
			.then(() => "inserted");
		await expect(dup).rejects.toThrow();
	});

	test("agents.owner_address must be a lowercase 0x address", async () => {
		const bad = t.db
			.execute(
				sql`insert into agents (token_id, owner_address, name, model, minted_tx, minted_block) values (1, '0xABCDEF0000000000000000000000000000000001', 'x', 'm', '0x1', 1)`,
			)
			.then(() => "inserted");
		await expect(bad).rejects.toThrow();
		await t.db.execute(
			sql`insert into agents (token_id, owner_address, name, model, minted_tx, minted_block) values (1, '0xabcdef0000000000000000000000000000000001', 'x', 'm', '0x1', 1)`,
		);
	});
});
