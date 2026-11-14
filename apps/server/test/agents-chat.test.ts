// apps/server/test/agents-chat.test.ts
// Agent access and chat, with the mock Router. Chain calls are not needed here
// (the confirm flow is tested on anvil in integration/agents.test.ts).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AeonServices } from "@aeon/api/context";
import { sealContext } from "@aeon/api/routers/agents";
import { createWalletLinker } from "@aeon/auth";
import { parseDeployment } from "@aeon/chain";
import { createAgentWallet, createSecretBox, utf8 } from "@aeon/crypto";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { usageEvents } from "@aeon/db/schema/runtime";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { startMockRouter } from "@aeon/harness/mock-router";
import { eq, sql } from "drizzle-orm";
import { createPublicClient, http, type PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { createApp } from "../src/app";
import { bearer, setupTestApp, siweSignIn, testEnv } from "./helpers";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const router = startMockRouter();
const box = createSecretBox(`0x${"ab".repeat(32)}`);
const aeon: AeonServices = {
	// nothing listens here: balance reads fail and come back as null
	client: createPublicClient({
		transport: http("http://127.0.0.1:9"),
	}) as PublicClient,
	deployment: parseDeployment({
		chainId: 31337,
		startBlock: 0,
		deployer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
		nft: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
		registry: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
		escrow: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
	}),
	box,
	router: { baseURL: router.url, apiKey: "sk-test" },
	catalog: DEFAULT_CATALOG,
};

let t: Awaited<ReturnType<typeof setupTestApp>>;
let owner: { token: string; userId: string };
let stranger: { token: string };
let agentId: string;
beforeAll(async () => {
	t = await setupTestApp({ aeon });
	const a = await siweSignIn(t.app, privateKeyToAccount(generatePrivateKey()));
	const b = await siweSignIn(t.app, privateKeyToAccount(generatePrivateKey()));
	owner = { token: a.token ?? "", userId: a.userId ?? "" };
	stranger = { token: b.token ?? "" };
	agentId = await insertAgent(owner.userId, "Speak like a ship's captain.");
});
afterAll(async () => {
	router.stop();
	await t.close();
});

async function insertAgent(userId: string, persona: string) {
	const wallet = createAgentWallet();
	const address = wallet.address.toLowerCase();
	const [row] = await t.db
		.insert(agents)
		.values({
			tokenId: BigInt(Math.floor(Math.random() * 1e9)),
			ownerAddress: address,
			ownerUserId: userId,
			name: "Captain",
			model: "glm-5.2",
			personaCipher: Buffer.from(
				await box.seal(utf8(persona), sealContext.persona(address)),
			),
			mintedTx: "0x01",
			mintedBlock: 1n,
		})
		.returning();
	await t.db.insert(agentWallets).values({
		agentId: row?.id ?? "",
		address,
		publicKey: wallet.publicKey,
		keyCipher: Buffer.from(
			await box.seal(utf8(wallet.privateKey), sealContext.walletKey(address)),
		),
	});
	return row?.id ?? "";
}

const chat = (id: string, token: string | undefined, content: string) =>
	t.app.request(`/api/agents/${id}/chat`, {
		method: "POST",
		headers: bearer(token),
		body: JSON.stringify({ messages: [{ role: "user", content }] }),
	});

describe("agent access", () => {
	test("the owner lists and reads their agent; balance is null when the chain is unreachable", async () => {
		const list = await t.app.request("/api/agents", {
			headers: bearer(owner.token),
		});
		expect(list.status).toBe(200);
		const body = (await list.json()) as {
			agents: { id: string; balanceWei: string | null }[];
		};
		expect(body.agents.map((a) => a.id)).toEqual([agentId]);
		expect(body.agents[0]?.balanceWei).toBeNull();

		const one = await t.app.request(`/api/agents/${agentId}`, {
			headers: bearer(owner.token),
		});
		expect(one.status).toBe(200);
	});

	test("another user cannot see or chat with it, and gets 404, not 403", async () => {
		const list = await t.app.request("/api/agents", {
			headers: bearer(stranger.token),
		});
		expect(((await list.json()) as { agents: unknown[] }).agents).toEqual([]);
		const one = await t.app.request(`/api/agents/${agentId}`, {
			headers: bearer(stranger.token),
		});
		expect(one.status).toBe(404);
		expect((await chat(agentId, stranger.token, "hi")).status).toBe(404);
	});

	test("chat needs a session and a valid body", async () => {
		expect((await chat(agentId, undefined, "hi")).status).toBe(401);
		const bad = await t.app.request(`/api/agents/${agentId}/chat`, {
			method: "POST",
			headers: bearer(owner.token),
			body: JSON.stringify({ messages: [] }),
		});
		expect(bad.status).toBe(400);
	});
});

describe("chat", () => {
	test("streams the reply over SSE, sends the persona, and records a usage row", async () => {
		router.reset();
		router.script({
			text: ["Ahoy", ", owner!"],
			trace: "4242",
			usage: [30, 4],
		});
		const res = await chat(agentId, owner.token, "hello");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/event-stream");
		const stream = await res.text();
		expect(stream).toContain('"delta":"Ahoy"');
		expect(stream).toContain('"delta":", owner!"');

		const sent = JSON.stringify(router.requests[0]?.body.messages);
		expect(sent).toContain("Speak like a ship's captain.");

		const usage = await waitForUsage(agentId);
		expect(usage).toMatchObject({
			kind: "chat",
			model: "glm-5.2",
			promptTokens: 30,
			completionTokens: 4,
			cost: 4242n,
			userId: owner.userId,
		});
	});

	test("a canary in the message or the reply never reaches the database or the logs", async () => {
		const canary = `CANARY-${crypto.randomUUID()}`;
		router.reset();
		router.script({ text: [`echo ${canary}`], trace: "1" });
		const logged: string[] = [];
		const restore = captureConsole(logged);
		try {
			const res = await chat(agentId, owner.token, `remember ${canary}`);
			expect(await res.text()).toContain(canary); // the owner does get the reply
			await waitForUsage(agentId, 2);
		} finally {
			restore();
		}
		expect(JSON.stringify(router.requests[0]?.body)).toContain(canary); // sanity: it was sent
		expect(logged.join("\n")).not.toContain(canary);
		expect(await dumpDatabase()).not.toContain(canary);
	});

	test("without chain, keys and Router configured, chat answers 503", async () => {
		const bare = createApp({
			db: t.db,
			auth: t.auth,
			wallets: createWalletLinker(t.auth, t.db, testEnv),
			corsOrigin: testEnv.CORS_ORIGIN,
			version: "test",
			logRequests: false,
		});
		const res = await bare.request(`/api/agents/${agentId}/chat`, {
			method: "POST",
			headers: bearer(owner.token),
			body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
		});
		expect(res.status).toBe(503);
	});
});

async function waitForUsage(id: string, count = 1) {
	for (let i = 0; i < 100; i++) {
		const rows = await t.db
			.select()
			.from(usageEvents)
			.where(eq(usageEvents.agentId, id));
		if (rows.length >= count) return rows[rows.length - 1];
		await Bun.sleep(20);
	}
	throw new Error("no usage row");
}

function captureConsole(into: string[]) {
	const methods = ["log", "info", "warn", "error", "debug"] as const;
	const saved = methods.map((m) => console[m]);
	for (const m of methods) {
		console[m] = (...args: unknown[]) => {
			into.push(
				args
					.map((a) =>
						a instanceof Error ? `${a.message} ${a.stack}` : String(a),
					)
					.join(" "),
			);
		};
	}
	return () =>
		methods.forEach((m, i) => {
			console[m] = saved[i] as (typeof console)[typeof m];
		});
}

/** Every row of every table, as text (bytea as hex and as UTF-8). */
async function dumpDatabase() {
	const tables = await t.db.execute<{ table_name: string }>(
		sql`select table_name from information_schema.tables where table_schema = 'public'`,
	);
	const parts: string[] = [];
	for (const { table_name } of tables.rows) {
		const rows = await t.db.execute<Record<string, unknown>>(
			sql`select * from ${sql.identifier(table_name)}`,
		);
		parts.push(
			JSON.stringify(rows.rows, (_k, v) => {
				if (typeof v === "bigint") return v.toString();
				if (
					v &&
					typeof v === "object" &&
					(v as { type?: string }).type === "Buffer"
				) {
					const b = Buffer.from((v as { data: number[] }).data);
					return `${b.toString("hex")} ${b.toString("utf8")}`;
				}
				return v;
			}),
		);
	}
	return parts.join("\n");
}
