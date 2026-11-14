// apps/server/src/evaluator.ts
// The evaluator worker: judges submitted work for jobs whose evaluator is a wallet we
// hold (a buyer's own agent, or the Aeon Verifier), then completes or disputes on chain.
// Cheap, certain checks run first; the model is asked only what code cannot answer:
//   1. integrity  - the result's hash matches resultHash on chain and it decrypts
//   2. contract   - the task's acceptance rules (format, fields, phrases, size)
//   3. judgment   - the model's structured verdict, the result passed as quoted data
//   4. decision   - pass -> complete; fail -> dispute; unsure -> an approval for the owner
// After a completion by an agent evaluator, the result is archived into that agent's vault.
import { agentVault, openAgentKey, serverSigner } from "@aeon/api/agent-keys";
import type { AeonServices } from "@aeon/api/context";
import { aeonEscrowAbi } from "@aeon/chain";
import {
	createEnvelope,
	type Envelope,
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
import {
	approvals,
	jobArchives,
	jobVerdicts,
} from "@aeon/db/schema/evaluation";
import { jobDeliveries, jobRuns } from "@aeon/db/schema/hiring";
import { usageEvents } from "@aeon/db/schema/runtime";
import {
	CostMeter,
	checkResult,
	DEFAULT_MODEL,
	judge,
	parseTaskSpec,
	requireModel,
	routerErrorCode,
	routerModel,
	type TaskSpec,
} from "@aeon/harness";
import type { BlobStore, Root } from "@aeon/storage";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Hex } from "viem";

export type EvaluatorDeps = {
	db: Database;
	aeon: AeonServices;
	store: BlobStore;
	workerId: string;
	/** the Aeon Verifier's key, when this worker runs it */
	verifierKey?: Hex;
};

export type EvalOutcome = {
	jobId: bigint;
	status: "completed" | "disputed" | "waiting" | "failed" | "retry";
	verdict?: "pass" | "fail" | "unsure";
	checks?: string[];
	archived?: boolean;
	errorCode?: string;
};

const MAX_ATTEMPTS = 5;
const SUBMITTED = 2;
type Job = typeof jobs.$inferSelect;
type Decision = {
	verdict: "pass" | "fail" | "unsure";
	checks: string[];
	score: number | null;
	reasons: string;
	model: string | null;
};

class JudgeError extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}

/** Queues an evaluator run for every submitted job judged by a wallet we hold. */
export async function enqueueEvaluatorRuns(
	db: Database,
	verifier?: string,
): Promise<number> {
	const result = await db.execute<{ job_id: string }>(sql`
		insert into job_runs (job_id, role)
		select j.id, 'evaluator' from jobs j
		where j.state = 'submitted'
			and (j.evaluator_address in (select address from agent_wallets)
				or j.evaluator_address = ${verifier?.toLowerCase() ?? ""})
		on conflict do nothing
		returning job_id`);
	return result.rows.length;
}

/** Claims one run: fresh, retrying, or waiting on an owner who has now decided. */
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
			locked_until = now() + interval '5 minutes',
			started_at = coalesce(started_at, now())
		where (job_id, role) = (
			select r.job_id, r.role from job_runs r
			where r.role = 'evaluator'
				and r.status in ('queued', 'running', 'delivered')
				and r.attempts < ${MAX_ATTEMPTS}
				and (r.locked_until is null or r.locked_until < now())
				and (r.status <> 'delivered' or exists (
					select 1 from approvals a where a.job_id = r.job_id
						and a.kind = 'verdict' and a.status in ('approved', 'rejected')))
			order by r.created_at
			limit 1
			for update of r skip locked
		)
		returning job_id, status, attempts`);
	return result.rows[0] ?? null;
}

const setRun = (
	db: Database,
	jobId: string,
	values: Partial<typeof jobRuns.$inferInsert>,
) =>
	db
		.update(jobRuns)
		.set(values)
		.where(and(eq(jobRuns.jobId, jobId), eq(jobRuns.role, "evaluator")));

/** Runs at most one evaluation. Returns what happened, or null when there is nothing to do. */
export async function runEvaluatorOnce(
	deps: EvaluatorDeps,
): Promise<EvalOutcome | null> {
	const { db, aeon } = deps;
	await enqueueEvaluatorRuns(db, aeon.verifier?.address);
	const run = await claim(db, deps.workerId);
	if (!run) return null;
	const [job] = await db.select().from(jobs).where(eq(jobs.id, run.job_id));
	if (!job) return null;

	try {
		const outcome = await evaluate(deps, job, run.status === "delivered");
		const done = outcome.status === "waiting" ? "delivered" : "decided";
		await setRun(db, job.id, {
			status: done,
			lockedBy: null,
			lockedUntil: null,
			finishedAt: done === "decided" ? new Date() : null,
		});
		return outcome;
	} catch (err) {
		const code =
			err instanceof JudgeError
				? err.code
				: routerErrorCode(err) !== "UNKNOWN"
					? routerErrorCode(err)
					: "INTERNAL";
		console.error(`evaluator run for job ${job.chainJobId} failed: ${code}`);
		const final = err instanceof JudgeError || run.attempts >= MAX_ATTEMPTS;
		await setRun(db, job.id, {
			...(final ? { status: "failed", finishedAt: new Date() } : {}),
			errorCode: code,
			lockedBy: null,
			lockedUntil: final ? null : new Date(Date.now() + 5_000 * run.attempts),
		});
		return {
			jobId: job.chainJobId,
			status: final ? "failed" : "retry",
			errorCode: code,
		};
	}
}

/** The evaluator's key and, when it is one of our agents, that agent. */
async function evaluatorIdentity(deps: EvaluatorDeps, job: Job) {
	const { db, aeon } = deps;
	if (
		aeon.verifier &&
		deps.verifierKey &&
		job.evaluatorAddress === aeon.verifier.address.toLowerCase()
	) {
		return {
			privateKey: deps.verifierKey,
			agent: null,
			ownerUserId: job.createdByUserId,
		};
	}
	const [row] = await db
		.select({ agent: agents, wallet: agentWallets })
		.from(agentWallets)
		.innerJoin(agents, eq(agents.id, agentWallets.agentId))
		.where(eq(agentWallets.address, job.evaluatorAddress));
	if (!row) throw new JudgeError("NOT_OUR_EVALUATOR");
	return {
		privateKey: await openAgentKey(aeon, row.wallet),
		agent: row.agent,
		ownerUserId: row.agent.ownerUserId,
	};
}

async function evaluate(
	deps: EvaluatorDeps,
	job: Job,
	resuming: boolean,
): Promise<EvalOutcome> {
	const { db, aeon } = deps;
	const me = await evaluatorIdentity(deps, job);
	const onchain = await aeon.client.readContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "getJob",
		args: [job.chainJobId],
	});
	if (onchain.state !== SUBMITTED) throw new JudgeError("JOB_NOT_SUBMITTED");

	// Resuming after the owner answered an "unsure": their decision is the verdict.
	if (resuming) {
		const [approval] = await db
			.select()
			.from(approvals)
			.where(
				and(
					eq(approvals.jobId, job.id),
					eq(approvals.kind, "verdict"),
					inArray(approvals.status, ["approved", "rejected"]),
				),
			);
		if (!approval) throw new JudgeError("NO_DECISION");
		const pass = approval.status === "approved";
		await settle(deps, job, me.privateKey, pass);
		await db
			.update(approvals)
			.set({ status: "done", stateCipher: null })
			.where(eq(approvals.id, approval.id));
		const archived = pass ? await archive(deps, job, me) : false;
		return {
			jobId: job.chainJobId,
			status: pass ? "completed" : "disputed",
			verdict: pass ? "pass" : "fail",
			archived,
		};
	}

	const { decision, taskEnv } = await decide(deps, job, me, onchain.resultHash);
	const reasonsCipher =
		taskEnv && decision.reasons
			? Buffer.from(
					serializeEnvelope(
						await createEnvelope({
							plaintext: utf8(decision.reasons),
							aad: { ...taskEnv.aad, kind: "result" },
							recipients: envelopeRecipients(taskEnv),
						}),
					),
				)
			: null;
	// one decision per job: a second run keeps the first verdict
	await db
		.insert(jobVerdicts)
		.values({
			jobId: job.id,
			evaluatorAddress: job.evaluatorAddress,
			verdict: decision.verdict,
			checks: decision.checks,
			score: decision.score,
			reasonsCipher,
			model: decision.model,
		})
		.onConflictDoNothing();

	if (decision.verdict === "unsure") {
		await db.insert(approvals).values({
			kind: "verdict",
			userId: me.ownerUserId,
			agentId: me.agent?.id ?? null,
			jobId: job.id,
			tokenId: job.tokenId.toString(),
			amount: job.amount.toString(),
			reason: decision.checks.join(",") || "MODEL_UNSURE",
		});
		return {
			jobId: job.chainJobId,
			status: "waiting",
			verdict: "unsure",
			checks: decision.checks,
		};
	}

	const pass = decision.verdict === "pass";
	await settle(deps, job, me.privateKey, pass);
	const archived = pass ? await archive(deps, job, me) : false;
	return {
		jobId: job.chainJobId,
		status: pass ? "completed" : "disputed",
		verdict: decision.verdict,
		checks: decision.checks,
		archived,
	};
}

/** Steps 1 to 3: integrity, the task's contract, then (only if both pass) the model. */
async function decide(
	deps: EvaluatorDeps,
	job: Job,
	me: { privateKey: Hex; agent: typeof agents.$inferSelect | null },
	resultHash: Hex,
): Promise<{ decision: Decision; taskEnv: Envelope | null }> {
	const { db, aeon } = deps;
	const rows = await db
		.select()
		.from(jobDeliveries)
		.where(eq(jobDeliveries.jobId, job.id));
	const taskRow = rows.find((r) => r.kind === "task");
	const resultRow = rows.find((r) => r.kind === "result");
	const taskEnv = taskRow?.envelope
		? parseEnvelope(new Uint8Array(taskRow.envelope))
		: null;
	const fail = (
		checks: string[],
	): { decision: Decision; taskEnv: Envelope | null } => ({
		decision: { verdict: "fail", checks, score: 0, reasons: "", model: null },
		taskEnv,
	});

	// 1. integrity: the bytes we judge are the bytes the provider committed to
	if (!resultRow) return fail(["INTEGRITY:NO_RESULT"]);
	const bytes = resultRow.envelope
		? new Uint8Array(resultRow.envelope)
		: await deps.store.get(resultRow.ogRootHash as Root).catch(() => null);
	if (!bytes) return fail(["INTEGRITY:UNAVAILABLE"]);
	let content: string;
	try {
		const env = parseEnvelope(bytes);
		if (envelopeHash(env).toLowerCase() !== resultHash.toLowerCase()) {
			return fail(["INTEGRITY:HASH_MISMATCH"]);
		}
		const plain = JSON.parse(
			fromUtf8(await openEnvelope(env, me.privateKey)),
		) as { content?: unknown };
		if (typeof plain.content !== "string") return fail(["INTEGRITY:SHAPE"]);
		content = plain.content;
	} catch {
		return fail(["INTEGRITY:UNREADABLE"]);
	}

	// 2. the task's contract, checked by code
	let spec: TaskSpec | null = null;
	if (taskEnv) {
		try {
			spec = parseTaskSpec(
				fromUtf8(await openEnvelope(taskEnv, me.privateKey)),
			);
		} catch {
			spec = null;
		}
	}
	if (!spec) {
		// we cannot see what was asked: leave it to the owner
		return {
			decision: {
				verdict: "unsure",
				checks: ["TASK_UNREADABLE"],
				score: null,
				reasons: "",
				model: null,
			},
			taskEnv,
		};
	}
	const broken = checkResult(spec, content);
	if (broken.length > 0) return fail(broken);

	// 3. the model's judgment, on Router credit; the result reaches it as quoted data
	const modelId = me.agent?.model ?? DEFAULT_MODEL;
	const meter = new CostMeter(requireModel(aeon.catalog, modelId));
	const verdict = await judge(
		routerModel(aeon.router, modelId, meter),
		spec,
		content,
		{ onUsage: (u) => meter.addUsage(u) },
	);
	await meter.settled();
	if (me.agent) {
		await db.insert(usageEvents).values({
			userId: me.agent.ownerUserId,
			agentId: me.agent.id,
			jobId: job.chainJobId,
			kind: "evaluate",
			model: modelId,
			promptTokens: meter.inputTokens,
			completionTokens: meter.outputTokens,
			cost: meter.costNeuron(),
			traceId: meter.traceIds[0] ?? null,
		});
	}
	return {
		decision: {
			verdict: verdict.verdict,
			checks: verdict.failedCriteria.map((c) => `CRITERION:${c}`),
			score: verdict.score,
			reasons: verdict.reasons,
			model: modelId,
		},
		taskEnv,
	};
}

/** Step 4 on chain: complete (pay) or dispute, from the evaluator wallet. */
async function settle(
	deps: EvaluatorDeps,
	job: Job,
	privateKey: Hex,
	pass: boolean,
): Promise<Hex> {
	const { db, aeon } = deps;
	const signer = serverSigner(aeon, privateKey);
	const hash = await signer.writeContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: pass ? "complete" : "dispute",
		args: [job.chainJobId],
		chain: signer.chain,
	});
	const receipt = await aeon.client.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error("settle reverted");
	await db
		.update(jobVerdicts)
		.set({ decidedTx: hash })
		.where(eq(jobVerdicts.jobId, job.id));
	return hash;
}

/** Archives a completed job's result into the evaluator agent's vault. Never throws. */
async function archive(
	deps: EvaluatorDeps,
	job: Job,
	me: { privateKey: Hex; agent: typeof agents.$inferSelect | null },
): Promise<boolean> {
	if (!me.agent) return false; // the Aeon Verifier keeps no archive
	const { db, aeon } = deps;
	try {
		const [resultRow] = await db
			.select()
			.from(jobDeliveries)
			.where(
				and(eq(jobDeliveries.jobId, job.id), eq(jobDeliveries.kind, "result")),
			);
		const bytes = resultRow?.envelope
			? new Uint8Array(resultRow.envelope)
			: await deps.store.get(resultRow?.ogRootHash as Root);
		// re-encrypt under a fresh entry key: the archive holds no other party's key
		const plaintext = await openEnvelope(parseEnvelope(bytes), me.privateKey);
		const vault = agentVault(aeon, deps.store, {
			tokenId: me.agent.tokenId,
			privateKey: me.privateKey,
		});
		const saved = await vault.archive(job.chainJobId.toString(), plaintext);
		await db
			.insert(jobArchives)
			.values({
				jobId: job.id,
				agentId: me.agent.id,
				entryRoot: saved.entry.rootHash,
				manifestRoot: saved.manifestRoot,
				anchorTx: saved.txHash,
			})
			.onConflictDoNothing();
		return true;
	} catch (err) {
		console.error(
			`archive for job ${job.chainJobId} failed: ${(err as Error).name}`,
		);
		return false;
	}
}
