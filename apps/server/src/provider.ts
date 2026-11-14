// apps/server/src/provider.ts
// The provider worker: does hired work while the agent's owner is offline.
//   enqueue  - a job_runs row for every funded job of an agent whose wallet we hold
//   claim    - one run whose task has arrived, with FOR UPDATE SKIP LOCKED
//   run      - open the task with the agent wallet, run the agent, seal the result for the
//              same readers, store it (mailbox, or 0G over the cap), then submit on chain
// A run records "delivered" before it submits, so a crash in between resumes at submit
// without running the model or uploading again.
import type { AeonServices } from "@aeon/api/context";
import { sealContext } from "@aeon/api/routers/agents";
import { aeonEscrowAbi } from "@aeon/chain";
import {
	createEnvelope,
	envelopeHash,
	envelopeRecipients,
	openEnvelope,
	parseEnvelope,
	serializeEnvelope,
	utf8,
} from "@aeon/crypto";
import { fromUtf8 } from "@aeon/crypto/encoding";
import type { Database } from "@aeon/db";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { jobs } from "@aeon/db/schema/chain";
import { jobDeliveries, jobRuns } from "@aeon/db/schema/hiring";
import { usageEvents } from "@aeon/db/schema/runtime";
import {
	CostMeter,
	createRoleAgent,
	defineTools,
	providerRole,
	quoteTask,
	requireModel,
	routerErrorCode,
	routerModel,
	walletBalanceTool,
} from "@aeon/harness";
import type { BlobStore } from "@aeon/storage";
import { and, eq, sql } from "drizzle-orm";
import { createWalletClient, custom, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type ProviderDeps = {
	db: Database;
	aeon: AeonServices;
	/** where results over the mailbox cap go (0G in production) */
	store: BlobStore;
	workerId: string;
	/** envelopes up to this size stay in the mailbox */
	mailboxMaxBytes?: number;
	/** test hook: runs right before the submit transaction */
	beforeSubmit?: () => Promise<void>;
};

export type RunOutcome = {
	jobId: bigint;
	status: "submitted" | "failed" | "retry";
	errorCode?: string;
};

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
/** Gas the agent wallet must be able to pay before it starts work (submit plus slack). */
const WORK_GAS = 300_000n;
const FUNDED = 1;
const SUBMITTED = 2;

class RunError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}

/** Queues a provider run for every funded job of an agent we hold. Duplicates are no-ops. */
export async function enqueueProviderRuns(db: Database): Promise<number> {
	const result = await db.execute<{ job_id: string }>(sql`
		insert into job_runs (job_id, role)
		select j.id, 'provider' from jobs j
		join agents a on a.token_id = j.token_id
		join agent_wallets w on w.agent_id = a.id
		where j.state = 'funded'
		on conflict do nothing
		returning job_id`);
	return result.rows.length;
}

/** Claims one provider run whose task has arrived. Returns null when there is none. */
async function claim(db: Database, workerId: string) {
	const result = await db.execute<{
		job_id: string;
		status: string;
		attempts: number;
	}>(sql`
		update job_runs set
			status = case when status = 'queued' then 'running' else status end,
			attempts = attempts + 1,
			locked_by = ${workerId},
			locked_until = now() + ${`${LOCK_MS} milliseconds`}::interval,
			started_at = coalesce(started_at, now())
		where (job_id, role) = (
			select r.job_id, r.role from job_runs r
			join job_deliveries d
				on d.job_id = r.job_id and d.kind = 'task' and d.deleted_at is null
			where r.role = 'provider'
				and r.status in ('queued', 'running', 'delivered')
				and r.attempts < ${MAX_ATTEMPTS}
				and (r.locked_until is null or r.locked_until < now())
			order by r.created_at
			limit 1
			for update of r skip locked
		)
		returning job_id, status, attempts`);
	return result.rows[0] ?? null;
}

async function finish(
	db: Database,
	jobId: string,
	status: "submitted" | "failed",
	errorCode?: string,
) {
	await db
		.update(jobRuns)
		.set({
			status,
			errorCode: errorCode ?? null,
			lockedBy: null,
			lockedUntil: null,
			finishedAt: new Date(),
		})
		.where(and(eq(jobRuns.jobId, jobId), eq(jobRuns.role, "provider")));
}

/** Runs at most one provider job. Returns what happened, or null when the queue is empty. */
export async function runProviderOnce(
	deps: ProviderDeps,
): Promise<RunOutcome | null> {
	const { db } = deps;
	await enqueueProviderRuns(db);
	const run = await claim(db, deps.workerId);
	if (!run) return null;
	const [job] = await db.select().from(jobs).where(eq(jobs.id, run.job_id));
	if (!job) return null;

	try {
		await work(deps, job, run.status === "delivered");
		await finish(db, job.id, "submitted");
		return { jobId: job.chainJobId, status: "submitted" };
	} catch (err) {
		const code =
			err instanceof RunError
				? err.code
				: routerErrorCode(err) !== "UNKNOWN"
					? routerErrorCode(err)
					: "INTERNAL";
		// codes only: never log task text, keys or the error message
		console.error(`provider run for job ${job.chainJobId} failed: ${code}`);
		if (err instanceof RunError || run.attempts >= MAX_ATTEMPTS) {
			await finish(db, job.id, "failed", code);
			return { jobId: job.chainJobId, status: "failed", errorCode: code };
		}
		// let it be claimed again after a short backoff
		await db
			.update(jobRuns)
			.set({
				errorCode: code,
				lockedBy: null,
				lockedUntil: new Date(Date.now() + 5_000 * run.attempts),
			})
			.where(and(eq(jobRuns.jobId, job.id), eq(jobRuns.role, "provider")));
		return { jobId: job.chainJobId, status: "retry", errorCode: code };
	}
}

type Job = typeof jobs.$inferSelect;

/** A wallet client for the agent wallet, sending through the same RPC as the reads. */
function agentSigner(aeon: AeonServices, privateKey: Hex) {
	const client = aeon.client;
	return createWalletClient({
		account: privateKeyToAccount(privateKey),
		chain: client.chain,
		transport: custom({ request: (args) => client.request(args as never) }),
	});
}
type Signer = ReturnType<typeof agentSigner>;

async function work(deps: ProviderDeps, job: Job, delivered: boolean) {
	const { db, aeon } = deps;
	const client = aeon.client;
	const [row] = await db
		.select({ agent: agents, wallet: agentWallets })
		.from(agents)
		.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
		.where(eq(agents.tokenId, job.tokenId));
	if (!row) throw new RunError("NOT_OUR_AGENT");
	const { agent, wallet } = row;

	const privateKey = fromUtf8(
		await aeon.box.open(
			new Uint8Array(wallet.keyCipher),
			sealContext.walletKey(wallet.address),
		),
	) as Hex;
	const signer = agentSigner(aeon, privateKey);

	const onchain = await client.readContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "getJob",
		args: [job.chainJobId],
	});
	const [result] = await db
		.select()
		.from(jobDeliveries)
		.where(
			and(eq(jobDeliveries.jobId, job.id), eq(jobDeliveries.kind, "result")),
		);

	if (
		onchain.state === SUBMITTED &&
		result?.payloadHash === onchain.resultHash
	) {
		return; // an earlier attempt's submit went through
	}
	if (onchain.state !== FUNDED) throw new RunError("JOB_CLOSED");
	const block = await client.getBlock();
	if (block.timestamp >= onchain.expiredAt) throw new RunError("TOO_LATE");

	let resultHash = result?.payloadHash as Hex | undefined;
	if (!delivered || !resultHash) {
		// Can the agent wallet pay for its own submit? If not, give the money back now.
		const [balance, gasPrice] = await Promise.all([
			client.getBalance({ address: wallet.address as Hex }),
			client.getGasPrice(),
		]);
		if (balance < gasPrice * WORK_GAS) {
			await declineIfAffordable(deps, job, signer, balance, gasPrice);
		}
		resultHash = await produceResult(deps, job, agent, wallet, privateKey);
	}

	await deps.beforeSubmit?.();
	const hash = await signer.writeContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "submit",
		args: [job.chainJobId, resultHash],
		chain: signer.chain,
	});
	const receipt = await client.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("submit reverted");
}

async function declineIfAffordable(
	deps: ProviderDeps,
	job: Job,
	signer: Signer,
	balance: bigint,
	gasPrice: bigint,
): Promise<never> {
	const { aeon } = deps;
	const account = signer.account;
	const gas = await aeon.client
		.estimateContractGas({
			address: aeon.deployment.escrow,
			abi: aeonEscrowAbi,
			functionName: "decline",
			args: [job.chainJobId],
			account,
		})
		.catch(() => null);
	if (gas === null || balance < gas * gasPrice) throw new RunError("NO_GAS");
	const hash = await signer.writeContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "decline",
		args: [job.chainJobId],
		chain: signer.chain,
		gas,
		gasPrice, // a legacy price, so the cost is exactly what was checked above
	});
	await aeon.client.waitForTransactionReceipt({ hash });
	throw new RunError("DECLINED_NO_GAS");
}

/** Runs the agent on the task and stores the sealed result. Returns the result hash. */
async function produceResult(
	deps: ProviderDeps,
	job: Job,
	agent: typeof agents.$inferSelect,
	wallet: typeof agentWallets.$inferSelect,
	privateKey: Hex,
): Promise<Hex> {
	const { db, aeon } = deps;
	const [task] = await db
		.select()
		.from(jobDeliveries)
		.where(
			and(eq(jobDeliveries.jobId, job.id), eq(jobDeliveries.kind, "task")),
		);
	if (!task?.envelope) throw new RunError("NO_TASK");
	const taskEnv = parseEnvelope(new Uint8Array(task.envelope));
	const text = fromUtf8(
		await openEnvelope(taskEnv, privateKey).catch(() => {
			throw new RunError("TASK_UNREADABLE");
		}),
	);

	const persona = agent.personaCipher
		? fromUtf8(
				await aeon.box.open(
					new Uint8Array(agent.personaCipher),
					sealContext.persona(wallet.address),
				),
			)
		: "";
	const meter = new CostMeter(requireModel(aeon.catalog, agent.model));
	const provider = createRoleAgent({
		role: providerRole,
		model: routerModel(aeon.router, agent.model, meter),
		tools: defineTools({
			wallet_balance: walletBalanceTool(() =>
				aeon.client.getBalance({ address: wallet.address as Hex }),
			),
		}),
		ctx: {
			agentId: agent.id,
			tokenId: agent.tokenId,
			ownerUserId: agent.ownerUserId,
			role: "provider",
			jobId: job.chainJobId,
			hireDepth: job.hireDepth,
			// spend at most half the job's price on compute
			budgetNeuron: job.amount / 2n > 0n ? job.amount / 2n : 1n,
		},
		meter,
		persona,
	});
	const output = await provider.generate({ prompt: quoteTask(text) });
	await meter.settled();
	await db.insert(usageEvents).values({
		userId: agent.ownerUserId,
		agentId: agent.id,
		jobId: job.chainJobId,
		kind: "job",
		model: agent.model,
		promptTokens: meter.inputTokens,
		completionTokens: meter.outputTokens,
		cost: meter.costNeuron(),
		traceId: meter.traceIds[0] ?? null,
	});

	// Sealed for exactly the readers of the task: client, provider, evaluator.
	const resultEnv = await createEnvelope({
		plaintext: utf8(
			JSON.stringify({
				v: 1,
				contentType: "text/markdown",
				content: output.text,
			}),
		),
		aad: { ...taskEnv.aad, kind: "result" },
		recipients: envelopeRecipients(taskEnv),
		meta: { contentType: "application/json" },
	});
	const bytes = serializeEnvelope(resultEnv);
	const hash = envelopeHash(resultEnv);
	const limit = deps.mailboxMaxBytes ?? aeon.mailbox?.maxBytes ?? 1024 * 1024;
	const base = {
		jobId: job.id,
		kind: "result" as const,
		payloadHash: hash,
		sizeBytes: bytes.length,
		uploaderAddress: wallet.address,
		expiresAt: new Date(
			job.expiredAt.getTime() + job.acceptWindowS * 1000 + 24 * 3600 * 1000,
		),
	};
	const row =
		bytes.length <= limit
			? { ...base, storage: "mailbox" as const, envelope: Buffer.from(bytes) }
			: {
					...base,
					storage: "og" as const,
					ogRootHash: (await deps.store.put(bytes)).root,
				};
	await db.transaction(async (tx) => {
		await tx.insert(jobDeliveries).values(row).onConflictDoNothing();
		await tx
			.update(jobRuns)
			.set({ status: "delivered" })
			.where(and(eq(jobRuns.jobId, job.id), eq(jobRuns.role, "provider")));
	});
	return hash;
}
