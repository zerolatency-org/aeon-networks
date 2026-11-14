// packages/api/src/routers/jobs.ts
// Hiring, from the buyer's side. The buyer's own wallet sends createJob; the server
// checks what landed on chain, keeps the encrypted task in the mailbox, and queues the
// provider run. Money moves only on chain, content only as ciphertext.
import { aeonEscrowAbi, aeonRegistryAbi } from "@aeon/chain";
import {
	type Envelope,
	envelopeHash,
	envelopeRecipients,
	serializeEnvelope,
} from "@aeon/crypto";
import type { Database } from "@aeon/db";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { walletAddress } from "@aeon/db/schema/auth";
import { jobs } from "@aeon/db/schema/chain";
import { jobDeliveries, jobRuns } from "@aeon/db/schema/hiring";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNull, or, sum } from "drizzle-orm";
import { encodeFunctionData, type Hex, parseEventLogs } from "viem";
import { z } from "zod";

import type { AeonServices } from "../context";
import { aeonProcedure, walletProcedure } from "../index";
import { visibleListing } from "./market";

const fail = (code: string, status: number, message = code) =>
	new ORPCError(code, { status, message });

export const MAILBOX_DEFAULTS = {
	maxBytes: 1024 * 1024,
	quotaBytes: 16 * 1024 * 1024,
};
/** How long an undelivered-to mailbox row may outlive the job's accept window. */
const MAILBOX_GRACE_MS = 24 * 60 * 60 * 1000;
const FUNDED = 1; // AeonEscrow.State.Funded

const Address = z
	.string()
	.regex(/^0x[0-9a-fA-F]{40}$/)
	.transform((a) => a.toLowerCase() as Hex);
const Bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const JobId = z.string().regex(/^\d{1,30}$/);

const EnvelopeInput = z.object({
	v: z.literal(1),
	alg: z.literal("A256GCM"),
	iv: z.string().max(64),
	ct: z.string(),
	aad: z.object({
		chainId: z.number().int(),
		escrow: z.string(),
		tokenId: z.string(),
		client: z.string(),
		kind: z.enum(["task", "result", "archive"]),
	}),
	keys: z.record(z.string(), z.string()),
	meta: z
		.object({
			maxResultBytes: z.number().int().positive().optional(),
			contentType: z.string().max(100).optional(),
			publicKeys: z.record(z.string(), z.string()).optional(),
		})
		.optional(),
});

type JobRow = typeof jobs.$inferSelect;
type Role = "client" | "provider" | "evaluator";

const jobView = (j: JobRow, roles: Role[]) => ({
	jobId: j.chainJobId.toString(),
	tokenId: j.tokenId.toString(),
	state: j.state,
	client: j.clientAddress,
	payee: j.payeeAddress,
	evaluator: j.evaluatorAddress,
	amount: j.amount.toString(),
	taskHash: j.taskHash,
	resultHash: j.resultHash,
	expiredAt: j.expiredAt.toISOString(),
	acceptWindowS: j.acceptWindowS,
	submittedAt: j.submittedAt?.toISOString() ?? null,
	settledAt: j.settledAt?.toISOString() ?? null,
	roles,
});

async function walletsOf(db: Database, userId: string): Promise<string[]> {
	const rows = await db
		.select({ address: walletAddress.address })
		.from(walletAddress)
		.where(eq(walletAddress.userId, userId));
	return rows.map((r) => r.address.toLowerCase());
}

/** What the user is to this job: client, provider (owns the hired agent) and/or evaluator. */
async function rolesIn(
	db: Database,
	userId: string,
	wallets: string[],
	job: JobRow,
): Promise<Role[]> {
	const roles: Role[] = [];
	if (wallets.includes(job.clientAddress)) roles.push("client");
	const [owned] = await db
		.select({ id: agents.id })
		.from(agents)
		.where(
			and(eq(agents.tokenId, job.tokenId), eq(agents.ownerUserId, userId)),
		);
	if (owned || wallets.includes(job.payeeAddress)) roles.push("provider");
	if (wallets.includes(job.evaluatorAddress)) roles.push("evaluator");
	return roles;
}

/** The job and the caller's roles in it. Anyone who is not a party gets a 404. */
async function partyJob(db: Database, userId: string, jobId: string) {
	const [job] = await db
		.select()
		.from(jobs)
		.where(eq(jobs.chainJobId, BigInt(jobId)));
	if (!job) throw fail("NOT_FOUND", 404, "No such job");
	const wallets = await walletsOf(db, userId);
	const roles = await rolesIn(db, userId, wallets, job);
	if (roles.length === 0) throw fail("NOT_FOUND", 404, "No such job");
	return { job, roles, wallets };
}

/** Queues the provider run when we hold the hired agent's wallet. Safe to call twice. */
export async function enqueueProviderRun(db: Database, job: JobRow) {
	const [ours] = await db
		.select({ id: agents.id })
		.from(agents)
		.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
		.where(eq(agents.tokenId, job.tokenId));
	if (!ours) return false;
	await db
		.insert(jobRuns)
		.values({ jobId: job.id, role: "provider" })
		.onConflictDoNothing();
	return true;
}

const readJob = (aeon: AeonServices, jobId: bigint) =>
	aeon.client.readContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "getJob",
		args: [jobId],
	});

export const jobsRouter = {
	prepare: aeonProcedure
		.route({ method: "POST", path: "/jobs/prepare" })
		.input(
			z.object({
				tokenId: JobId,
				/** keccak256 of the serialized task envelope the client already built */
				taskHash: Bytes32,
				amount: z
					.string()
					.regex(/^\d{1,30}$/)
					.optional(),
				expiresInS: z.number().int().positive().default(3600),
				acceptWindowS: z.number().int().positive().default(3600),
				evaluator: Address.optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const { aeon, db, wallet } = context;
			const tokenId = BigInt(input.tokenId);
			const listing = await visibleListing(db, tokenId);
			if (!listing) throw fail("NOT_FOUND", 404, "That agent is not listed");

			const read = (
				functionName: "minAmount" | "minWindow" | "maxWindow" | "maxLifetime",
			) =>
				aeon.client.readContract({
					address: aeon.deployment.escrow,
					abi: aeonEscrowAbi,
					functionName,
				});
			const [minAmount, minWindow, maxWindow, maxLifetime, block] =
				await Promise.all([
					read("minAmount"),
					read("minWindow"),
					read("maxWindow"),
					read("maxLifetime"),
					aeon.client.getBlock(),
				]);
			let floor = minAmount; // the escrow minimum, or the listing price if higher
			if (listing.price > floor) floor = listing.price;
			const amount = input.amount ? BigInt(input.amount) : floor;
			if (amount < floor) {
				throw fail(
					"AMOUNT_TOO_LOW",
					400,
					`This agent costs at least ${floor} wei`,
				);
			}
			// a minute of slack so the deadline still holds when the transaction is mined
			if (
				input.expiresInS < Number(minWindow) + 60 ||
				input.expiresInS > Number(maxLifetime)
			) {
				throw fail(
					"BAD_EXPIRY",
					400,
					`expiresInS must be ${Number(minWindow) + 60}..${maxLifetime}`,
				);
			}
			if (
				input.acceptWindowS < Number(minWindow) ||
				input.acceptWindowS > Number(maxWindow)
			) {
				throw fail(
					"BAD_WINDOW",
					400,
					`acceptWindowS must be ${minWindow}..${maxWindow}`,
				);
			}
			const payee = listing.owner;
			if (wallet.address === payee) {
				throw fail("CLIENT_IS_PAYEE", 400, "You cannot hire your own agent");
			}
			const evaluator = input.evaluator ?? wallet.address;
			if (evaluator === payee || evaluator === listing.agentWallet) {
				throw fail(
					"BAD_EVALUATOR",
					400,
					"The provider cannot judge its own work",
				);
			}
			const expiredAt = block.timestamp + BigInt(input.expiresInS);
			return {
				chainId: aeon.deployment.chainId,
				escrow: aeon.deployment.escrow,
				tokenId: input.tokenId,
				client: wallet.address,
				payee,
				evaluator,
				provider: listing.agentWallet,
				amount: amount.toString(),
				expiredAt: expiredAt.toString(),
				acceptWindowS: input.acceptWindowS,
				tx: {
					chainId: aeon.deployment.chainId,
					to: aeon.deployment.escrow,
					value: amount.toString(),
					data: encodeFunctionData({
						abi: aeonEscrowAbi,
						functionName: "createJob",
						args: [
							tokenId,
							input.taskHash as Hex,
							expiredAt,
							input.acceptWindowS,
							evaluator,
						],
					}),
				},
			};
		}),

	confirm: aeonProcedure
		.route({ method: "POST", path: "/jobs/confirm" })
		.input(z.object({ txHash: Bytes32 }))
		.handler(async ({ context, input }) => {
			const { aeon, db } = context;
			const userId = context.session.user.id;
			const receipt = await aeon.client
				.getTransactionReceipt({ hash: input.txHash as Hex })
				.catch(() => null);
			if (!receipt)
				throw fail("NOT_MINED", 409, "Transaction not found or not mined yet");
			if (receipt.status !== "success") throw fail("TX_FAILED", 400);
			const [created] = parseEventLogs({
				abi: aeonEscrowAbi,
				eventName: "JobCreated",
				logs: receipt.logs.filter(
					(l) =>
						l.address.toLowerCase() === aeon.deployment.escrow.toLowerCase(),
				),
			});
			if (!created) throw fail("JOB_NOT_FOUND", 400, "No Aeon job in that tx");
			const a = created.args;
			const wallets = await walletsOf(db, userId);
			if (!wallets.includes(a.client.toLowerCase())) {
				throw fail(
					"FORBIDDEN",
					403,
					"That job was created by a wallet you have not linked",
				);
			}
			// Same row the indexer writes for JobCreated, plus who hired through Aeon.
			await db
				.insert(jobs)
				.values({
					chainJobId: a.jobId,
					tokenId: a.tokenId,
					clientAddress: a.client.toLowerCase(),
					payeeAddress: a.payee.toLowerCase(),
					evaluatorAddress: a.evaluator.toLowerCase(),
					amount: a.amount,
					state: "funded",
					taskHash: a.taskHash,
					expiredAt: new Date(Number(a.expiredAt) * 1000),
					acceptWindowS: Number(a.acceptWindow),
					createTx: receipt.transactionHash,
					lastEventBlock: receipt.blockNumber,
					createdByUserId: userId,
				})
				.onConflictDoUpdate({
					target: jobs.chainJobId,
					set: { createdByUserId: userId },
					setWhere: isNull(jobs.createdByUserId),
				});
			const [job] = await db
				.select()
				.from(jobs)
				.where(eq(jobs.chainJobId, a.jobId));
			if (!job) throw fail("INTERNAL", 500);
			const queued = await enqueueProviderRun(db, job);
			return {
				job: jobView(job, await rolesIn(db, userId, wallets, job)),
				providerQueued: queued,
			};
		}),

	list: walletProcedure
		.route({ method: "GET", path: "/jobs" })
		.handler(async ({ context }) => {
			const userId = context.session.user.id;
			const wallets = await walletsOf(context.db, userId);
			const owned = context.db
				.select({ tokenId: agents.tokenId })
				.from(agents)
				.where(eq(agents.ownerUserId, userId));
			const rows = await context.db
				.select()
				.from(jobs)
				.where(
					or(
						inArray(jobs.clientAddress, wallets),
						inArray(jobs.payeeAddress, wallets),
						inArray(jobs.evaluatorAddress, wallets),
						inArray(jobs.tokenId, owned),
					),
				)
				.orderBy(desc(jobs.chainJobId))
				.limit(100);
			const out = [];
			for (const job of rows) {
				out.push(jobView(job, await rolesIn(context.db, userId, wallets, job)));
			}
			return { jobs: out };
		}),

	get: walletProcedure
		.route({ method: "GET", path: "/jobs/{jobId}" })
		.input(z.object({ jobId: JobId }))
		.handler(async ({ context, input }) => {
			const { job, roles } = await partyJob(
				context.db,
				context.session.user.id,
				input.jobId,
			);
			const deliveries = await context.db
				.select({ kind: jobDeliveries.kind, storage: jobDeliveries.storage })
				.from(jobDeliveries)
				.where(
					and(eq(jobDeliveries.jobId, job.id), isNull(jobDeliveries.deletedAt)),
				);
			const [run] = await context.db
				.select({ status: jobRuns.status, errorCode: jobRuns.errorCode })
				.from(jobRuns)
				.where(and(eq(jobRuns.jobId, job.id), eq(jobRuns.role, "provider")));
			return {
				...jobView(job, roles),
				deliveries: deliveries.map((d) => d.kind),
				providerRun: run ?? null,
			};
		}),

	deliverTask: aeonProcedure
		.route({ method: "PUT", path: "/jobs/{jobId}/delivery/task" })
		.input(z.object({ jobId: JobId, envelope: EnvelopeInput }))
		.handler(async ({ context, input }) => {
			const { aeon, db } = context;
			const limits = aeon.mailbox ?? MAILBOX_DEFAULTS;
			const { job, roles, wallets } = await partyJob(
				db,
				context.session.user.id,
				input.jobId,
			);
			if (!roles.includes("client")) {
				throw fail("FORBIDDEN", 403, "Only the client delivers the task");
			}
			const [existing] = await db
				.select({ id: jobDeliveries.id })
				.from(jobDeliveries)
				.where(
					and(eq(jobDeliveries.jobId, job.id), eq(jobDeliveries.kind, "task")),
				);
			if (existing) throw fail("ALREADY_DELIVERED", 409);

			// The chain, not our copy, decides whether the job is funded and what the hash is.
			const onchain = await readJob(aeon, job.chainJobId);
			if (onchain.state !== FUNDED) throw fail("JOB_NOT_FUNDED", 409);

			const env = input.envelope as Envelope;
			const bytes = serializeEnvelope(env);
			if (bytes.length > limits.maxBytes) {
				throw fail(
					"PAYLOAD_TOO_LARGE",
					413,
					`Envelopes are capped at ${limits.maxBytes} bytes`,
				);
			}
			const hash = envelopeHash(env);
			if (hash.toLowerCase() !== onchain.taskHash.toLowerCase()) {
				throw fail(
					"HASH_MISMATCH",
					400,
					"Envelope does not match the job's taskHash",
				);
			}

			// The provider must be able to read it, and it must be bound to this job.
			const provider = (
				await aeon.client.readContract({
					address: aeon.deployment.registry,
					abi: aeonRegistryAbi,
					functionName: "agentWallet",
					args: [job.tokenId],
				})
			).toLowerCase();
			const readers = (() => {
				try {
					return envelopeRecipients(env).map((r) => r.address.toLowerCase());
				} catch {
					return null;
				}
			})();
			const aad = env.aad;
			if (
				!readers?.includes(provider) ||
				aad.kind !== "task" ||
				aad.chainId !== aeon.deployment.chainId ||
				aad.escrow.toLowerCase() !== aeon.deployment.escrow.toLowerCase() ||
				aad.tokenId !== job.tokenId.toString() ||
				aad.client.toLowerCase() !== job.clientAddress
			) {
				throw fail(
					"BAD_ENVELOPE",
					400,
					"Envelope is not addressed to this job's provider",
				);
			}

			const [used] = await db
				.select({ total: sum(jobDeliveries.sizeBytes) })
				.from(jobDeliveries)
				.where(
					and(
						inArray(jobDeliveries.uploaderAddress, wallets),
						isNull(jobDeliveries.deletedAt),
					),
				);
			if (Number(used?.total ?? 0) + bytes.length > limits.quotaBytes) {
				throw fail(
					"QUOTA_EXCEEDED",
					429,
					"Mailbox quota reached; wait for jobs to finish",
				);
			}

			const expiresAt = new Date(
				job.expiredAt.getTime() + job.acceptWindowS * 1000 + MAILBOX_GRACE_MS,
			);
			const inserted = await db
				.insert(jobDeliveries)
				.values({
					jobId: job.id,
					kind: "task",
					storage: "mailbox",
					envelope: Buffer.from(bytes),
					payloadHash: hash,
					sizeBytes: bytes.length,
					uploaderAddress: job.clientAddress,
					expiresAt,
				})
				.onConflictDoNothing()
				.returning({ id: jobDeliveries.id });
			if (inserted.length === 0) throw fail("ALREADY_DELIVERED", 409);
			return {
				jobId: input.jobId,
				size: bytes.length,
				expiresAt: expiresAt.toISOString(),
			};
		}),

	getDelivery: walletProcedure
		.route({ method: "GET", path: "/jobs/{jobId}/delivery/{kind}" })
		.input(z.object({ jobId: JobId, kind: z.enum(["task", "result"]) }))
		.handler(async ({ context, input }) => {
			// client, provider and evaluator only; anyone else sees a 404
			const { job } = await partyJob(
				context.db,
				context.session.user.id,
				input.jobId,
			);
			const [d] = await context.db
				.select()
				.from(jobDeliveries)
				.where(
					and(
						eq(jobDeliveries.jobId, job.id),
						eq(jobDeliveries.kind, input.kind),
						isNull(jobDeliveries.deletedAt),
					),
				);
			if (!d) throw fail("NOT_FOUND", 404, "Nothing delivered yet");
			return {
				kind: d.kind,
				storage: d.storage,
				payloadHash: d.payloadHash,
				size: d.sizeBytes,
				ogRootHash: d.ogRootHash,
				envelope: d.envelope
					? (JSON.parse(Buffer.from(d.envelope).toString("utf8")) as Envelope)
					: null,
			};
		}),

	prepareAction: aeonProcedure
		.route({ method: "POST", path: "/jobs/{jobId}/action/prepare" })
		.input(
			z.object({
				jobId: JobId,
				action: z.enum([
					"complete",
					"dispute",
					"decline",
					"claimRefund",
					"claimTimeout",
					"forceClose",
				]),
			}),
		)
		.handler(async ({ context, input }) => {
			const { job, roles } = await partyJob(
				context.db,
				context.session.user.id,
				input.jobId,
			);
			const needs: Partial<Record<typeof input.action, Role>> = {
				complete: "evaluator",
				dispute: "evaluator",
				decline: "provider",
			};
			const role = needs[input.action];
			if (role && !roles.includes(role)) {
				throw fail("FORBIDDEN", 403, `Only the ${role} can ${input.action}`);
			}
			return {
				tx: {
					chainId: context.aeon.deployment.chainId,
					to: context.aeon.deployment.escrow,
					value: "0",
					data: encodeFunctionData({
						abi: aeonEscrowAbi,
						functionName: input.action,
						args: [job.chainJobId],
					}),
				},
			};
		}),
};
