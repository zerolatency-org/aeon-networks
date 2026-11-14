// apps/server/integration/hiring.test.ts
// A user hires an agent on a real anvil chain: encrypted task in the mailbox, the provider
// worker does the job while its owner is offline, the keeper settles the timer paths.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AeonServices } from "@aeon/api/context";
import { aeonEscrowAbi } from "@aeon/chain";
import {
	createAgentWallet,
	createEnvelope,
	createSecretBox,
	type Envelope,
	envelopeHash,
	type KeyPair,
	openEnvelope,
	type Recipient,
	serializeEnvelope,
	utf8,
} from "@aeon/crypto";
import { jobs } from "@aeon/db/schema/chain";
import { jobDeliveries, jobRuns } from "@aeon/db/schema/hiring";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { startMockRouter } from "@aeon/harness/mock-router";
import { type BlobStore, createMemoryStore } from "@aeon/storage";
import { and, eq, inArray, ne, sum } from "drizzle-orm";
import { type Hex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { catchUp } from "../src/indexer/indexer";
import { runKeeperOnce } from "../src/keeper";
import { enqueueProviderRuns, runProviderOnce } from "../src/provider";
import { setupTestApp, siweSignIn } from "../test/helpers";
import { call, createAgent, listingAction, send } from "./api-helpers";
import {
	account,
	type Chain,
	privateKeyOf,
	startChain,
	walletFor,
} from "./chain-helpers";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const ALICE = 4; // owns the provider agent, offline the whole time
const BOB = 5; // the buyer
const CAROL = 6; // an evaluator
const DAVE = 7; // nobody

let chain: Chain;
let t: Awaited<ReturnType<typeof setupTestApp>>;
let aeon: AeonServices;
const router = startMockRouter();
const tokens: Record<number, string> = {};
let scribe: { id: string; tokenId: bigint; wallet: Hex; publicKey: Hex };
const bobVault: KeyPair = createAgentWallet(); // stands in for Bob's derived vault key

/** A memory store that counts uploads. */
function countingStore(): BlobStore & { puts: number } {
	const inner = createMemoryStore();
	const store = {
		puts: 0,
		put: async (bytes: Uint8Array) => {
			store.puts++;
			return inner.put(bytes);
		},
		get: (root: `0x${string}`) => inner.get(root),
	};
	return store;
}

beforeAll(async () => {
	chain = await startChain();
	aeon = {
		client: chain.client,
		deployment: chain.deployment,
		box: createSecretBox(`0x${"ef".repeat(32)}`),
		router: { baseURL: router.url, apiKey: "sk-test" },
		catalog: DEFAULT_CATALOG,
		mailbox: { maxBytes: 4000, quotaBytes: 1_000_000 },
	};
	t = await setupTestApp({ aeon });
	for (const i of [ALICE, BOB, CAROL, DAVE]) {
		tokens[i] =
			(await siweSignIn(t.app, privateKeyToAccount(privateKeyOf(i)))).token ??
			"";
	}
	scribe = await listedAgent("Scribe", "Writes crisp summaries.");
	// the provider's agent wallet pays its own gas
	await walletFor(chain.rpcUrl, 0).sendTransaction({
		to: scribe.wallet,
		value: parseEther("1"),
	});
});
afterAll(async () => {
	router.stop();
	chain?.stop();
	await t?.close();
});

async function listedAgent(name: string, persona: string) {
	const agent = await createAgent(
		t.app,
		chain,
		tokens[ALICE] ?? "",
		ALICE,
		name,
		persona,
	);
	await listingAction(t.app, chain, tokens[ALICE] ?? "", ALICE, {
		agentId: agent.id,
		action: "list",
		price: parseEther("0.01").toString(),
	});
	const detail = (await (
		await t.app.request(`/api/market/agents/${agent.tokenId}`)
	).json()) as { hire: { agentPublicKey: Hex } };
	return { ...agent, publicKey: detail.hire.agentPublicKey };
}

/** Bob's client: encrypts the task, gets createJob from prepare, sends it, confirms. */
async function hire(opts: {
	agent?: typeof scribe;
	task?: string;
	evaluator?: Hex;
	expiresInS?: number;
	acceptWindowS?: number;
	readers?: Recipient[];
}) {
	const agent = opts.agent ?? scribe;
	const env = await createEnvelope({
		plaintext: utf8(opts.task ?? "Summarise the attached abstract."),
		aad: {
			chainId: chain.deployment.chainId,
			escrow: chain.deployment.escrow,
			tokenId: agent.tokenId.toString(),
			client: account(BOB).address,
			kind: "task",
		},
		recipients: opts.readers ?? [
			bobVault,
			{ address: agent.wallet, publicKey: agent.publicKey },
		],
	});
	const prepared = await call<{ tx: { to: Hex; data: Hex; value: string } }>(
		t.app,
		tokens[BOB],
		"POST",
		"/api/jobs/prepare",
		{
			tokenId: agent.tokenId.toString(),
			taskHash: envelopeHash(env),
			expiresInS: opts.expiresInS ?? 3600,
			acceptWindowS: opts.acceptWindowS ?? 3600,
			evaluator: opts.evaluator,
		},
	);
	expect(prepared.status).toBe(200);
	const txHash = await send(chain, BOB, prepared.body.tx);
	const confirmed = await call<{ job: { jobId: string } }>(
		t.app,
		tokens[BOB],
		"POST",
		"/api/jobs/confirm",
		{ txHash },
	);
	expect(confirmed.status).toBe(200);
	return { jobId: confirmed.body.job.jobId, env, txHash };
}

const deliver = (jobId: string, envelope: Envelope, who = BOB) =>
	call(t.app, tokens[who], "PUT", `/api/jobs/${jobId}/delivery/task`, {
		envelope,
	});

const onchainJob = (jobId: string) =>
	chain.client.readContract({
		address: chain.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "getJob",
		args: [BigInt(jobId)],
	});

const index = () =>
	catchUp({
		db: t.db,
		client: chain.client,
		deployment: chain.deployment,
		confirmations: 0,
		chunkSize: 1000,
	});

const keeper = () =>
	runKeeperOnce({
		db: t.db,
		client: chain.client,
		deployment: chain.deployment,
		keeper: privateKeyToAccount(privateKeyOf(8)),
	});

async function warp(seconds: number) {
	await chain.testClient.increaseTime({ seconds });
	await chain.testClient.mine({ blocks: 1 });
}

/** Leaves only this job's run in the queue, so the test claims the job it means to. */
async function onlyRun(jobId: string) {
	const [job] = await t.db
		.select({ id: jobs.id })
		.from(jobs)
		.where(eq(jobs.chainJobId, BigInt(jobId)));
	await t.db
		.update(jobRuns)
		.set({ status: "failed", errorCode: "PARKED_BY_TEST" })
		.where(
			and(
				ne(jobRuns.jobId, job?.id ?? ""),
				inArray(jobRuns.status, ["queued", "running", "delivered"]),
			),
		);
	return job?.id ?? "";
}

describe("hiring on anvil", () => {
	test("hire, deliver, the provider works while its owner is offline, the keeper pays on timeout", async () => {
		router.reset();
		router.script({
			text: ["The finished summary."],
			trace: "1000",
			usage: [40, 8],
		});
		const { jobId, env } = await hire({
			evaluator: account(CAROL).address.toLowerCase() as Hex,
			acceptWindowS: 60,
		});
		expect((await deliver(jobId, env)).status).toBe(200);
		await onlyRun(jobId);

		const store = countingStore();
		const outcome = await runProviderOnce({
			db: t.db,
			aeon,
			store,
			workerId: "w1",
		});
		expect(outcome).toMatchObject({ status: "submitted" });

		// the task reached the model quoted, with the owner's persona in the instructions
		const sent = JSON.stringify(router.requests[0]?.body.messages);
		expect(sent).toContain("<task>");
		expect(sent).toContain("Summarise the attached abstract.");
		expect(sent).toContain("Writes crisp summaries.");

		const onchain = await onchainJob(jobId);
		expect(onchain.state).toBe(2); // Submitted
		const result = await call<{ envelope: Envelope; payloadHash: Hex }>(
			t.app,
			tokens[BOB],
			"GET",
			`/api/jobs/${jobId}/delivery/result`,
		);
		expect(result.status).toBe(200);
		expect(result.body.payloadHash).toBe(onchain.resultHash);
		expect(envelopeHash(result.body.envelope)).toBe(onchain.resultHash);
		const opened = JSON.parse(
			new TextDecoder().decode(
				await openEnvelope(result.body.envelope, bobVault.privateKey),
			),
		) as { content: string };
		expect(opened.content).toBe("The finished summary.");

		// only the three parties can fetch it
		for (const who of [ALICE, CAROL]) {
			const res = await call(
				t.app,
				tokens[who],
				"GET",
				`/api/jobs/${jobId}/delivery/result`,
			);
			expect(res.status).toBe(200);
		}
		const stranger = await call(
			t.app,
			tokens[DAVE],
			"GET",
			`/api/jobs/${jobId}/delivery/task`,
		);
		expect(stranger.status).toBe(404);

		// the evaluator stays silent; after the window the keeper pays the owner
		await index();
		const before = await chain.client.getBalance({
			address: account(ALICE).address,
		});
		await warp(61);
		const acted = await keeper();
		expect(acted.filter((a) => a.jobId === BigInt(jobId))).toEqual([
			expect.objectContaining({ action: "claimTimeout" }),
		]);
		expect((await keeper()).some((a) => a.jobId === BigInt(jobId))).toBe(false);
		const after = await chain.client.getBalance({
			address: account(ALICE).address,
		});
		const amount = parseEther("0.01");
		expect(after - before).toBe(amount - (amount * 250n) / 10_000n);
		await index();
		const [row] = await t.db
			.select()
			.from(jobs)
			.where(eq(jobs.chainJobId, BigInt(jobId)));
		expect(row?.state).toBe("timed_out");
	});

	test("a task delivery is refused unless it comes from the client, matches the hash and reaches the provider", async () => {
		const { jobId, env } = await hire({});
		expect((await deliver(jobId, env, DAVE)).status).toBe(404); // not a party
		expect((await deliver(jobId, env, ALICE)).status).toBe(403); // a party, not the client

		const other = await createEnvelope({
			plaintext: utf8("a different task"),
			aad: env.aad,
			recipients: [
				bobVault,
				{ address: scribe.wallet, publicKey: scribe.publicKey },
			],
		});
		const wrong = await deliver(jobId, other);
		expect(wrong.status).toBe(400);
		expect(wrong.body.code).toBe("HASH_MISMATCH");

		expect((await deliver(jobId, env)).status).toBe(200);
		const again = await deliver(jobId, env);
		expect(again.status).toBe(409);
		expect(again.body.code).toBe("ALREADY_DELIVERED");

		// hired with a task only Bob can read: the provider never could
		const sealedShut = await hire({ readers: [bobVault] });
		const bad = await deliver(sealedShut.jobId, sealedShut.env);
		expect(bad.status).toBe(400);
		expect(bad.body.code).toBe("BAD_ENVELOPE");
	});

	test("the size cap and the per-user quota hold", async () => {
		const big = await hire({ task: "x".repeat(5000) });
		const tooBig = await deliver(big.jobId, big.env);
		expect(tooBig.status).toBe(413);
		expect(tooBig.body.code).toBe("PAYLOAD_TOO_LARGE");

		const first = await hire({ task: "y".repeat(1500) });
		const second = await hire({ task: "z".repeat(1500) });
		const [used] = await t.db
			.select({ total: sum(jobDeliveries.sizeBytes) })
			.from(jobDeliveries)
			.where(
				eq(jobDeliveries.uploaderAddress, account(BOB).address.toLowerCase()),
			);
		const size = serializeEnvelope(first.env).length;
		aeon.mailbox = {
			maxBytes: 4000,
			quotaBytes: Number(used?.total ?? 0) + size + 10,
		};
		try {
			expect((await deliver(first.jobId, first.env)).status).toBe(200);
			const over = await deliver(second.jobId, second.env);
			expect(over.status).toBe(429);
			expect(over.body.code).toBe("QUOTA_EXCEEDED");
		} finally {
			aeon.mailbox = { maxBytes: 4000, quotaBytes: 1_000_000 };
		}
	});

	test("a duplicate confirm or event queues the job once", async () => {
		const { jobId, txHash } = await hire({});
		const again = await call(t.app, tokens[BOB], "POST", "/api/jobs/confirm", {
			txHash,
		});
		expect(again.status).toBe(200);
		await index();
		await enqueueProviderRuns(t.db);
		const [job] = await t.db
			.select()
			.from(jobs)
			.where(eq(jobs.chainJobId, BigInt(jobId)));
		const runs = await t.db
			.select()
			.from(jobRuns)
			.where(eq(jobRuns.jobId, job?.id ?? ""));
		expect(runs).toHaveLength(1);
	});

	test("a crash after the upload and before submit resumes without a second upload", async () => {
		router.reset();
		router.script({ text: ["Big result."], trace: "10" });
		const { jobId, env } = await hire({});
		await deliver(jobId, env);
		const runId = await onlyRun(jobId);

		const store = countingStore();
		let crash = true;
		const deps = {
			db: t.db,
			aeon,
			store,
			workerId: "w2",
			mailboxMaxBytes: 10, // force the result onto "0G"
			beforeSubmit: async () => {
				if (crash) {
					crash = false;
					throw new Error("power cut");
				}
			},
		};
		expect(await runProviderOnce(deps)).toMatchObject({ status: "retry" });
		const [mid] = await t.db
			.select()
			.from(jobRuns)
			.where(eq(jobRuns.jobId, runId));
		expect(mid?.status).toBe("delivered");
		expect(store.puts).toBe(1);

		await t.db
			.update(jobRuns)
			.set({ lockedUntil: null })
			.where(eq(jobRuns.jobId, runId));
		expect(await runProviderOnce(deps)).toMatchObject({ status: "submitted" });
		expect(store.puts).toBe(1); // no second upload
		expect(router.requests).toHaveLength(1); // and no second model run
		expect((await onchainJob(jobId)).state).toBe(2);
	});

	test("an agent wallet that cannot pay gas declines (or skips) instead of working", async () => {
		router.reset();
		const broke = await listedAgent("Broke Bot", "Never funded.");

		const skipped = await hire({ agent: broke });
		await deliver(skipped.jobId, skipped.env);
		await onlyRun(skipped.jobId);
		const deps = { db: t.db, aeon, store: countingStore(), workerId: "w3" };
		expect(await runProviderOnce(deps)).toMatchObject({
			status: "failed",
			errorCode: "NO_GAS",
		});

		// enough for a decline, not for the work: the buyer gets the money back at once
		const gasPrice = await chain.client.getGasPrice();
		await chain.testClient.setBalance({
			address: broke.wallet,
			value: gasPrice * 150_000n,
		});
		const declined = await hire({ agent: broke });
		await deliver(declined.jobId, declined.env);
		await onlyRun(declined.jobId);
		expect(await runProviderOnce(deps)).toMatchObject({
			status: "failed",
			errorCode: "DECLINED_NO_GAS",
		});
		expect((await onchainJob(declined.jobId)).state).toBe(5); // Declined
		expect(router.requests).toHaveLength(0); // the model never ran
	});

	test("the keeper refunds only when due, once; a refunded job takes no task", async () => {
		const { jobId, env } = await hire({ expiresInS: 180 });
		expect((await keeper()).some((a) => a.jobId === BigInt(jobId))).toBe(false);
		await warp(181);
		const acted = (await keeper()).filter((a) => a.jobId === BigInt(jobId));
		expect(acted).toEqual([expect.objectContaining({ action: "claimRefund" })]);
		expect((await keeper()).some((a) => a.jobId === BigInt(jobId))).toBe(false);
		expect((await onchainJob(jobId)).state).toBe(6); // Refunded

		const late = await deliver(jobId, env);
		expect(late.status).toBe(409);
		expect(late.body.code).toBe("JOB_NOT_FUNDED");
	});
});
