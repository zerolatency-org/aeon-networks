// apps/server/src/keeper.ts
// The keeper: pushes jobs nobody is acting on through the escrow's timer paths.
//   funded past expiredAt                   -> claimRefund  (buyer gets everything back)
//   submitted past submittedAt+acceptWindow -> claimTimeout (provider's owner is paid)
//   disputed past disputedAt+disputeLimit   -> forceClose   (buyer gets everything back)
// It re-reads the job and the chain's clock before sending, so it acts only on jobs that
// are due, and a job it already moved is no longer due on the next pass.
import { aeonEscrowAbi, type Deployment } from "@aeon/chain";
import type { Database } from "@aeon/db";
import { jobs } from "@aeon/db/schema/chain";
import { and, eq, lte, or, sql } from "drizzle-orm";
import {
	createWalletClient,
	custom,
	type PrivateKeyAccount,
	type PublicClient,
} from "viem";

export type KeeperDeps = {
	db: Database;
	client: PublicClient;
	deployment: Deployment;
	/** KEEPER_PRIVATE_KEY: pays gas for timer calls, holds no other power */
	keeper: PrivateKeyAccount;
	batch?: number;
};

export type KeeperAction = {
	jobId: bigint;
	action: "claimRefund" | "claimTimeout" | "forceClose";
	txHash: string;
};

const FUNDED = 1;
const SUBMITTED = 2;
const DISPUTED = 4;

export async function runKeeperOnce(deps: KeeperDeps): Promise<KeeperAction[]> {
	const { db, client, deployment } = deps;
	const head = await client.getBlock();
	const now = new Date(Number(head.timestamp) * 1000);
	const disputeLimit = await client.readContract({
		address: deployment.escrow,
		abi: aeonEscrowAbi,
		functionName: "disputeLimit",
	});

	// Candidates from our copy (index on state, expired_at); the chain has the final say.
	const due = await db
		.select({ chainJobId: jobs.chainJobId })
		.from(jobs)
		.where(
			or(
				and(eq(jobs.state, "funded"), lte(jobs.expiredAt, now)),
				and(
					eq(jobs.state, "submitted"),
					sql`${jobs.submittedAt} + make_interval(secs => ${jobs.acceptWindowS}) <= ${now}`,
				),
				and(
					eq(jobs.state, "disputed"),
					sql`${jobs.disputedAt} + make_interval(secs => ${Number(disputeLimit)}) <= ${now}`,
				),
			),
		)
		.limit(deps.batch ?? 20);

	const wallet = createWalletClient({
		account: deps.keeper,
		chain: client.chain,
		transport: custom({ request: (args) => client.request(args as never) }),
	});
	const done: KeeperAction[] = [];
	for (const { chainJobId } of due) {
		const job = await client.readContract({
			address: deployment.escrow,
			abi: aeonEscrowAbi,
			functionName: "getJob",
			args: [chainJobId],
		});
		const t = head.timestamp;
		const action =
			job.state === FUNDED && t >= job.expiredAt
				? "claimRefund"
				: job.state === SUBMITTED &&
						t >= job.submittedAt + BigInt(job.acceptWindow)
					? "claimTimeout"
					: job.state === DISPUTED && t >= job.disputedAt + disputeLimit
						? "forceClose"
						: null;
		if (!action) continue; // already moved, or not due by the chain's clock
		try {
			const hash = await wallet.writeContract({
				address: deployment.escrow,
				abi: aeonEscrowAbi,
				functionName: action,
				args: [chainJobId],
				chain: wallet.chain,
			});
			const receipt = await client.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") throw new Error("reverted");
			done.push({ jobId: chainJobId, action, txHash: hash });
		} catch (err) {
			// logged, not retried in a loop: the next pass re-checks the chain
			console.error(
				`keeper ${action} for job ${chainJobId} failed: ${(err as Error).name}`,
			);
		}
	}
	return done;
}
