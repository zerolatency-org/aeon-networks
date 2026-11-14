// apps/server/integration/autonomy.test.ts
// P10 on a real anvil chain: an agent hires another on its owner's standing instruction,
// within a spending policy; over-policy hires wait for the owner; chains stop at the depth limit.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AeonServices } from "@aeon/api/context";
import { aeonEscrowAbi } from "@aeon/chain";
import { createSecretBox } from "@aeon/crypto";
import { jobs } from "@aeon/db/schema/chain";
import { jobRuns } from "@aeon/db/schema/hiring";
import { DEFAULT_CATALOG } from "@aeon/harness";
import { startMockRouter } from "@aeon/harness/mock-router";
import { createMemoryStore } from "@aeon/storage";
import { and, eq, inArray, ne } from "drizzle-orm";
import { type Hex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { runBuyerOnce } from "../src/buyer";
import { runEvaluatorOnce } from "../src/evaluator";
import { runApprovedHiresOnce } from "../src/hiring";
import { catchUp } from "../src/indexer/indexer";
import { runProviderOnce } from "../src/provider";
import { setupTestApp, siweSignIn } from "../test/helpers";
import { call, createAgent, listingAction } from "./api-helpers";
import {
	account,
	type Chain,
	privateKeyOf,
	startChain,
	walletFor,
} from "./chain-helpers";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const ALICE = 4; // owns Boss, the hiring agent
const BOB = 5; // owns Writer, the hired agent
const CAROL = 6; // owns Sub, whom Writer tries to hire

let chain: Chain;
let t: Awaited<ReturnType<typeof setupTestApp>>;
let aeon: AeonServices;
const router = startMockRouter();
const store = createMemoryStore();
const tokens: Record<number, string> = {};
let boss: { id: string; tokenId: bigint; wallet: Hex };
let writer: { id: string; tokenId: bigint; wallet: Hex };
let sub: { id: string; tokenId: bigint; wallet: Hex };

async function listed(owner: number, name: string) {
	const agent = await createAgent(
		t.app,
		chain,
		tokens[owner] ?? "",
		owner,
		name,
	);
	await listingAction(t.app, chain, tokens[owner] ?? "", owner, {
		agentId: agent.id,
		action: "list",
		price: parseEther("0.01").toString(),
		tags: ["writing"],
	});
	await walletFor(chain.rpcUrl, 0).sendTransaction({
		to: agent.wallet,
		value: parseEther("1"),
	});
	return agent;
}

beforeAll(async () => {
	chain = await startChain();
	aeon = {
		client: chain.client,
		deployment: chain.deployment,
		box: createSecretBox(`0x${"7b".repeat(32)}`),
		router: { baseURL: router.url, apiKey: "sk-test" },
		catalog: DEFAULT_CATALOG,
		store,
	};
	t = await setupTestApp({ aeon });
	for (const i of [ALICE, BOB, CAROL]) {
		tokens[i] =
			(await siweSignIn(t.app, privateKeyToAccount(privateKeyOf(i)))).token ??
			"";
	}
	boss = await createAgent(t.app, chain, tokens[ALICE] ?? "", ALICE, "Boss");
	await walletFor(chain.rpcUrl, 0).sendTransaction({
		to: boss.wallet,
		value: parseEther("1"),
	});
	writer = await listed(BOB, "Writer");
	sub = await listed(CAROL, "Sub");
});
afterAll(async () => {
	router.stop();
	chain?.stop();
	await t?.close();
});

const index = () =>
	catchUp({
		db: t.db,
		client: chain.client,
		deployment: chain.deployment,
		confirmations: 0,
		chunkSize: 1000,
	});
const nextJobId = () =>
	chain.client.readContract({
		address: chain.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "nextJobId",
	});
const instruct = (instruction: string) =>
	call(t.app, tokens[ALICE], "POST", `/api/agents/${boss.id}/tasks`, {
		instruction,
	});
const hireCall = (tokenId: bigint, task = "Write one line about rain.") => ({
	tool: "market_hire",
	args: { tokenId: tokenId.toString(), task, criteria: "It mentions rain." },
});

/** Leaves only this job's runs queued. */
async function onlyRuns(chainJobId: string) {
	const [job] = await t.db
		.select({ id: jobs.id })
		.from(jobs)
		.where(eq(jobs.chainJobId, BigInt(chainJobId)));
	await t.db
		.update(jobRuns)
		.set({ status: "failed", errorCode: "PARKED_BY_TEST" })
		.where(
			and(
				ne(jobRuns.jobId, job?.id ?? ""),
				inArray(jobRuns.status, ["queued", "running", "delivered"]),
			),
		);
}

describe("autonomous hiring on anvil", () => {
	test("one agent hires another, verifies it, and the owner is paid while both owners are offline", async () => {
		router.reset();
		router.script(
			{ tool: "market_search", args: { q: "writer" } }, // Boss looks around
			hireCall(writer.tokenId), // Boss proposes the hire; policy approves
			{ text: ["Hired the Writer."] },
			{ text: ["Rain taps the window."], trace: "10" }, // Writer works
			{
				text: [
					JSON.stringify({
						verdict: "pass",
						score: 0.95,
						failedCriteria: [],
						reasons: "about rain",
					}),
				],
			}, // Boss judges
		);
		expect(
			(await instruct("Get me one line of poetry about rain.")).status,
		).toBe(200);
		// from here on, neither Alice nor Bob does anything

		const bought = await runBuyerOnce({ db: t.db, aeon });
		expect(bought).toMatchObject({ status: "done", pendingApprovals: [] });
		const jobId = bought?.hired[0] ?? "";
		expect(jobId).not.toBe("");
		const [row] = await t.db
			.select()
			.from(jobs)
			.where(eq(jobs.chainJobId, BigInt(jobId)));
		expect(row).toMatchObject({
			clientAgentId: boss.id,
			clientAddress: boss.wallet,
			evaluatorAddress: boss.wallet,
			hireDepth: 1,
		});
		expect(JSON.stringify(router.requests[0]?.body.messages)).toContain(
			"<instruction>",
		);

		await onlyRuns(jobId);
		expect(
			await runProviderOnce({ db: t.db, aeon, store, workerId: "p" }),
		).toMatchObject({ status: "submitted" });
		await index();
		const before = await chain.client.getBalance({
			address: account(BOB).address,
		});
		expect(
			await runEvaluatorOnce({ db: t.db, aeon, store, workerId: "e" }),
		).toMatchObject({ status: "completed", verdict: "pass", archived: true });
		const after = await chain.client.getBalance({
			address: account(BOB).address,
		});
		expect(after - before).toBe(parseEther("0.01") - parseEther("0.00025"));
	});

	test("an over-policy hire waits for the owner and never calls createJob until approved", async () => {
		const policy = await call(
			t.app,
			tokens[ALICE],
			"PUT",
			`/api/agents/${boss.id}/policy`,
			{
				perJobCap: parseEther("0.005").toString(),
				dailyCap: parseEther("0.05").toString(),
			},
		);
		expect(policy.status).toBe(200);
		router.reset();
		router.script(hireCall(writer.tokenId), { text: ["Asked my owner."] });
		await instruct("Get me another line about rain.");

		const before = await nextJobId();
		const bought = await runBuyerOnce({ db: t.db, aeon });
		expect(bought).toMatchObject({ status: "done", hired: [] });
		expect(bought?.pendingApprovals).toHaveLength(1);
		expect(await nextJobId()).toBe(before); // no createJob was sent
		expect(await runApprovedHiresOnce(t.db, aeon)).toBeNull(); // not approved yet

		const approvalId = bought?.pendingApprovals[0];
		const stranger = await call(
			t.app,
			tokens[BOB],
			"POST",
			`/api/approvals/${approvalId}/decide`,
			{
				approve: true,
			},
		);
		expect(stranger.status).toBe(404);
		const ok = await call(
			t.app,
			tokens[ALICE],
			"POST",
			`/api/approvals/${approvalId}/decide`,
			{
				approve: true,
			},
		);
		expect(ok.status).toBe(200);

		const done = await runApprovedHiresOnce(t.db, aeon);
		expect(done?.jobId).toBe(before.toString());
		expect(await nextJobId()).toBe(before + 1n);
		await call(t.app, tokens[ALICE], "PUT", `/api/agents/${boss.id}/policy`, {
			perJobCap: parseEther("0.01").toString(),
			dailyCap: parseEther("1").toString(),
		});
	});

	test("a hired agent cannot hire again past the depth limit", async () => {
		router.reset();
		router.script(
			hireCall(writer.tokenId), // Boss (depth 0) hires Writer: allowed
			{ text: ["Hired."] },
			hireCall(sub.tokenId, "Do it for me."), // Writer (depth 1) tries to hire Sub
			{ text: ["Did it myself: rain."], trace: "10" },
		);
		await instruct("One more line about rain.");
		const bought = await runBuyerOnce({ db: t.db, aeon });
		const jobId = bought?.hired[0] ?? "";
		expect(jobId).not.toBe("");

		await onlyRuns(jobId);
		const before = await nextJobId();
		expect(
			await runProviderOnce({ db: t.db, aeon, store, workerId: "p" }),
		).toMatchObject({ status: "submitted" });
		expect(await nextJobId()).toBe(before); // Sub was never hired
		const toolResult = JSON.stringify(router.requests.at(-1)?.body.messages);
		expect(toolResult).toContain("DEPTH_LIMIT");
		const subJobs = await t.db
			.select()
			.from(jobs)
			.where(eq(jobs.tokenId, sub.tokenId));
		expect(subJobs).toHaveLength(0);
	});
});
