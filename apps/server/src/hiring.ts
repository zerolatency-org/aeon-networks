// apps/server/src/hiring.ts
// Agents hiring agents. The model proposes through market_hire; decideHire (plain code)
// decides. Only "approved" ever reaches createJob. "user-approval" stores the request,
// sealed, for the owner; the approved request later runs exactly as proposed.
import { openAgentKey, serverSigner } from "@aeon/api/agent-keys";
import type { AeonServices } from "@aeon/api/context";
import { policyOf } from "@aeon/api/routers/autonomy";
import { enqueueProviderRun } from "@aeon/api/routers/jobs";
import { searchListings, visibleListing } from "@aeon/api/routers/market";
import { aeonEscrowAbi } from "@aeon/chain";
import {
	createEnvelope,
	envelopeHash,
	serializeEnvelope,
	utf8,
} from "@aeon/crypto";
import { fromUtf8 } from "@aeon/crypto/encoding";
import type { Database } from "@aeon/db";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { jobs } from "@aeon/db/schema/chain";
import { approvals } from "@aeon/db/schema/evaluation";
import { jobDeliveries } from "@aeon/db/schema/hiring";
import { decideHire, type HireRequest, utcDayStart } from "@aeon/harness";
import { type Tool, tool } from "ai";
import { and, eq, gte, inArray, sum } from "drizzle-orm";
import { type Hex, parseEventLogs } from "viem";
import { z } from "zod";

/** The agent doing the hiring, with its key opened for this run. */
export type Hirer = {
	agent: typeof agents.$inferSelect;
	wallet: typeof agentWallets.$inferSelect;
	privateKey: Hex;
	/** depth of the run that hires: 0 for an owner's instruction, the job's depth for a provider */
	hireDepth: number;
	role: HireRequest["role"];
};

export type HireParams = { tokenId: string; task: string; criteria: string };

const HIRE_GAS = 400_000n; // createJob plus slack
const EXPIRES_IN_S = 3600n;
const ACCEPT_WINDOW_S = 600;

export async function loadHirer(
	db: Database,
	aeon: AeonServices,
	agentId: string,
	opts: { hireDepth: number; role: HireRequest["role"] },
): Promise<Hirer> {
	const [row] = await db
		.select({ agent: agents, wallet: agentWallets })
		.from(agents)
		.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
		.where(eq(agents.id, agentId));
	if (!row) throw new Error("NOT_OUR_AGENT");
	return { ...row, privateKey: await openAgentKey(aeon, row.wallet), ...opts };
}

/** Runs the money gate for one proposed hire. */
export async function gate(
	db: Database,
	aeon: AeonServices,
	hirer: Hirer,
	tokenId: bigint,
	ignoreCaps = false,
) {
	const policy = await policyOf(db, hirer.agent.id);
	const listing = await visibleListing(db, tokenId);
	const [minAmount, balance, gasPrice] = await Promise.all([
		aeon.client.readContract({
			address: aeon.deployment.escrow,
			abi: aeonEscrowAbi,
			functionName: "minAmount",
		}),
		aeon.client.getBalance({ address: hirer.wallet.address as Hex }),
		aeon.client.getGasPrice(),
	]);
	let price = minAmount;
	if (listing && listing.price > price) price = listing.price;
	const [spent] = await db
		.select({ total: sum(jobs.amount) })
		.from(jobs)
		.where(
			and(
				eq(jobs.clientAddress, hirer.wallet.address),
				gte(jobs.createdAt, utcDayStart(new Date())),
			),
		);
	const decision = decideHire({
		role: hirer.role,
		hireDepth: hirer.hireDepth,
		policy: ignoreCaps
			? { ...policy, perJobCap: price, dailyCap: 2n ** 255n }
			: policy,
		listing: listing
			? { active: true, jobsCompleted: listing.jobsCompleted }
			: null,
		price,
		balance,
		gasReserve: gasPrice * HIRE_GAS,
		spentToday: BigInt(spent?.total ?? 0),
	});
	return { decision, price, listing, policy };
}

/** Hires for real: seal the task, createJob from the agent wallet, record and deliver it. */
export async function executeHire(
	db: Database,
	aeon: AeonServices,
	hirer: Hirer,
	params: HireParams,
): Promise<{ jobId: string }> {
	const tokenId = BigInt(params.tokenId);
	const { price, listing, policy } = await gate(db, aeon, hirer, tokenId, true);
	if (!listing) throw new Error("LISTING_INACTIVE");
	const [provider] = await db
		.select({ publicKey: agentWallets.publicKey })
		.from(agentWallets)
		.where(eq(agentWallets.address, listing.agentWallet));
	if (!provider) throw new Error("PROVIDER_KEY_UNKNOWN");

	const me = {
		address: hirer.wallet.address as Hex,
		publicKey: hirer.wallet.publicKey as Hex,
	};
	const verifier =
		policy.evaluatorMode === "aeon_verifier" ? aeon.verifier : undefined;
	if (policy.evaluatorMode === "aeon_verifier" && !verifier) {
		throw new Error("NO_VERIFIER");
	}
	const evaluator = verifier ?? me;
	const env = await createEnvelope({
		plaintext: utf8(
			JSON.stringify({
				v: 1,
				prompt: params.task,
				accept: { criteria: params.criteria },
			}),
		),
		aad: {
			chainId: aeon.deployment.chainId,
			escrow: aeon.deployment.escrow,
			tokenId: tokenId.toString(),
			client: me.address,
			kind: "task",
		},
		recipients: [
			me,
			{
				address: listing.agentWallet as Hex,
				publicKey: provider.publicKey as Hex,
			},
			...(verifier ? [verifier] : []),
		],
	});
	const taskHash = envelopeHash(env);
	const block = await aeon.client.getBlock();
	const signer = serverSigner(aeon, hirer.privateKey);
	const hash = await signer.writeContract({
		address: aeon.deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "createJob",
		args: [
			tokenId,
			taskHash,
			block.timestamp + EXPIRES_IN_S,
			ACCEPT_WINDOW_S,
			evaluator.address,
		],
		value: price,
		chain: signer.chain,
	});
	const receipt = await aeon.client.waitForTransactionReceipt({ hash });
	const [created] = parseEventLogs({
		abi: aeonEscrowAbi,
		eventName: "JobCreated",
		logs: receipt.logs,
	});
	if (receipt.status !== "success" || !created)
		throw new Error("HIRE_REVERTED");
	const a = created.args;

	// the same row /jobs/confirm writes, marked as an agent's hire one level deeper
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
			createTx: hash,
			lastEventBlock: receipt.blockNumber,
			createdByUserId: hirer.agent.ownerUserId,
			clientAgentId: hirer.agent.id,
			hireDepth: hirer.hireDepth + 1,
		})
		.onConflictDoUpdate({
			target: jobs.chainJobId,
			set: {
				clientAgentId: hirer.agent.id,
				hireDepth: hirer.hireDepth + 1,
				createdByUserId: hirer.agent.ownerUserId,
			},
		});
	const [job] = await db
		.select()
		.from(jobs)
		.where(eq(jobs.chainJobId, a.jobId));
	if (!job) throw new Error("INTERNAL");
	const bytes = serializeEnvelope(env);
	await db
		.insert(jobDeliveries)
		.values({
			jobId: job.id,
			kind: "task",
			storage: "mailbox",
			envelope: Buffer.from(bytes),
			payloadHash: taskHash,
			sizeBytes: bytes.length,
			uploaderAddress: me.address,
			expiresAt: new Date(
				job.expiredAt.getTime() + job.acceptWindowS * 1000 + 24 * 3600 * 1000,
			),
		})
		.onConflictDoNothing();
	await enqueueProviderRun(db, job);
	return { jobId: a.jobId.toString() };
}

export type HireToolEvent =
	| { status: "hired"; jobId: string }
	| { status: "pending_approval"; approvalId: string; reason: string }
	| { status: "denied"; reason: string };

/** market_search and market_hire, bound to one hiring agent for one run. */
export function marketTools(
	db: Database,
	aeon: AeonServices,
	hirer: Hirer,
	onEvent: (e: HireToolEvent) => void = () => {},
): { market_search: Tool; market_hire: Tool } {
	return {
		market_search: tool({
			description:
				"Search the Aeon marketplace for agents to hire. Returns up to 5 listings.",
			inputSchema: z.object({
				q: z.string().max(200).optional(),
				tag: z.string().max(24).optional(),
			}),
			execute: async ({ q, tag }) => {
				const { items } = await searchListings(db, {
					q: q || undefined,
					tag: tag?.toLowerCase() || undefined,
					limit: 5,
				});
				return items.map((i) => ({
					tokenId: i.tokenId,
					name: i.name,
					description: i.description,
					tags: i.tags,
					priceWei: i.price,
					jobsCompleted: i.jobsCompleted,
				}));
			},
		}),
		market_hire: tool({
			description:
				"Hire a listed agent for one task. A spending policy decides; the result says hired, pending_approval or denied.",
			inputSchema: z.object({
				tokenId: z.string().regex(/^\d{1,30}$/),
				task: z.string().min(1).max(8000),
				criteria: z.string().max(2000).default(""),
			}),
			execute: async (params): Promise<HireToolEvent> => {
				const { decision, price } = await gate(
					db,
					aeon,
					hirer,
					BigInt(params.tokenId),
				);
				let event: HireToolEvent;
				if (decision.decision === "denied") {
					event = { status: "denied", reason: decision.reason };
				} else if (decision.decision === "user-approval") {
					const [row] = await db
						.insert(approvals)
						.values({
							kind: "hire",
							userId: hirer.agent.ownerUserId,
							agentId: hirer.agent.id,
							tokenId: params.tokenId,
							amount: price.toString(),
							reason: decision.reason,
							stateCipher: Buffer.from(
								await aeon.box.seal(
									utf8(
										JSON.stringify({ ...params, hireDepth: hirer.hireDepth }),
									),
									`approval:${hirer.agent.id}`,
								),
							),
						})
						.returning({ id: approvals.id });
					event = {
						status: "pending_approval",
						approvalId: row?.id ?? "",
						reason: decision.reason,
					};
				} else {
					event = {
						status: "hired",
						...(await executeHire(db, aeon, hirer, params)),
					};
				}
				onEvent(event);
				return event;
			},
		}),
	};
}

/** Runs one hire the owner approved. Depth, listing and funds are checked again. */
export async function runApprovedHiresOnce(
	db: Database,
	aeon: AeonServices,
): Promise<{ approvalId: string; jobId?: string; errorCode?: string } | null> {
	const [approval] = await db
		.update(approvals)
		.set({ status: "done" })
		.where(
			inArray(
				approvals.id,
				db
					.select({ id: approvals.id })
					.from(approvals)
					.where(
						and(eq(approvals.kind, "hire"), eq(approvals.status, "approved")),
					)
					.limit(1),
			),
		)
		.returning();
	if (!approval?.agentId || !approval.stateCipher) return null;
	try {
		const params = JSON.parse(
			fromUtf8(
				await aeon.box.open(
					new Uint8Array(approval.stateCipher),
					`approval:${approval.agentId}`,
				),
			),
		) as HireParams & { hireDepth: number };
		const hirer = await loadHirer(db, aeon, approval.agentId, {
			hireDepth: params.hireDepth,
			role: "buyer",
		});
		const { decision } = await gate(
			db,
			aeon,
			hirer,
			BigInt(params.tokenId),
			true,
		);
		if (decision.decision !== "approved") throw new Error(decision.reason);
		const { jobId } = await executeHire(db, aeon, hirer, params);
		await db
			.update(approvals)
			.set({ stateCipher: null })
			.where(eq(approvals.id, approval.id));
		return { approvalId: approval.id, jobId };
	} catch (err) {
		const errorCode = (err as Error).message.slice(0, 64);
		console.error(`approved hire ${approval.id} failed: ${errorCode}`);
		await db
			.update(approvals)
			.set({ status: "expired", reason: errorCode, stateCipher: null })
			.where(eq(approvals.id, approval.id));
		return { approvalId: approval.id, errorCode };
	}
}
