// apps/server/test/agents-avatar.test.ts
// The owner picks a face after minting. Only the 20 presets and the six tints are allowed.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { agents } from "@aeon/db/schema/aeon";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { bearer, setupTestApp, siweSignIn } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestApp>>;
let owner: { token: string; userId: string };
let stranger: { token: string };
let agentId: string;

beforeAll(async () => {
	t = await setupTestApp();
	const a = await siweSignIn(t.app, privateKeyToAccount(generatePrivateKey()));
	const b = await siweSignIn(t.app, privateKeyToAccount(generatePrivateKey()));
	owner = { token: a.token ?? "", userId: a.userId ?? "" };
	stranger = { token: b.token ?? "" };
	const [row] = await t.db
		.insert(agents)
		.values({
			tokenId: BigInt(Math.floor(Math.random() * 1e9)),
			ownerAddress: `0x${"1".repeat(40)}`,
			ownerUserId: owner.userId,
			name: "Scout",
			model: "glm-5.2",
			mintedTx: "0x01",
			mintedBlock: 1n,
		})
		.returning();
	agentId = row?.id ?? "";
});
afterAll(async () => {
	await t.close();
});

const save = (id: string, token: string | undefined, body: unknown) =>
	t.app.request(`/api/agents/${id}/avatar`, {
		method: "PUT",
		headers: bearer(token),
		body: JSON.stringify(body),
	});

const read = async () => {
	const res = await t.app.request(`/api/agents/${agentId}`, {
		headers: bearer(owner.token),
	});
	return (await res.json()) as { avatarKind: string; avatarRef: unknown };
};

describe("agent avatar", () => {
	test("a new agent starts with the default preset p01", async () => {
		expect(await read()).toMatchObject({
			avatarKind: "preset",
			avatarRef: "p01",
		});
	});

	test("the owner picks a preset and the agent shows it", async () => {
		const res = await save(agentId, owner.token, {
			avatar: { kind: "preset", ref: "p07" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			avatarKind: "preset",
			avatarRef: "p07",
		});
		expect(await read()).toMatchObject({
			avatarKind: "preset",
			avatarRef: "p07",
		});
	});

	test("the owner picks a generated face and the seed is stored trimmed and lower case", async () => {
		const res = await save(agentId, owner.token, {
			avatar: { kind: "dicebear", ref: { seed: "  Ada ", bg: "moss" } },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			avatarKind: "dicebear",
			avatarRef: { seed: "ada", bg: "moss" },
		});
	});

	test("unknown presets, uploads, unknown tints and bad seeds are refused", async () => {
		const bad = [
			{ avatar: { kind: "preset", ref: "p21" } },
			{ avatar: { kind: "preset", ref: "p1" } },
			{ avatar: { kind: "upload", ref: "m1" } },
			{ avatar: { kind: "dicebear", ref: { seed: "ada", bg: "pink" } } },
			{ avatar: { kind: "dicebear", ref: { seed: "   ", bg: "moss" } } },
			{
				avatar: { kind: "dicebear", ref: { seed: "x".repeat(41), bg: "moss" } },
			},
		];
		for (const body of bad) {
			expect(
				(await save(agentId, owner.token, body)).status,
				JSON.stringify(body),
			).toBe(400);
		}
	});

	test("a stranger gets 404, and no session gets 401", async () => {
		const body = { avatar: { kind: "preset", ref: "p02" } };
		expect((await save(agentId, stranger.token, body)).status).toBe(404);
		expect((await save(agentId, undefined, body)).status).toBe(401);
	});
});
