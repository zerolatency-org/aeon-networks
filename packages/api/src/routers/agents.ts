// packages/api/src/routers/agents.ts
// Minting an agent is two calls around the user's own transactions:
//   prepare  -> server makes the agent wallet, returns the mint call for the user to send
//   confirm  -> server reads the mint receipt, creates the agent, returns the authorize call
// The server never sends a transaction for the user; it only verifies what landed on chain.
import { aeonAgentNftAbi } from "@aeon/chain";
import { createAgentWallet, utf8 } from "@aeon/crypto";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { walletAddress } from "@aeon/db/schema/auth";
import { agentDrafts } from "@aeon/db/schema/runtime";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { encodeFunctionData, type Hex, keccak256, parseEventLogs } from "viem";
import { z } from "zod";

import type { AeonServices } from "../context";
import { aeonProcedure, walletProcedure } from "../index";

/** UPDATE_SLOTS | SIGN_JOBS: the agent wallet may anchor its vault and sign jobs. */
const AGENT_PERMISSIONS = 3n;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const fail = (code: string, status: number, message = code) =>
	new ORPCError(code, { status, message });

export const sealContext = {
	walletKey: (address: string) => `agent-wallet:${address.toLowerCase()}`,
	persona: (address: string) => `persona:${address.toLowerCase()}`,
};

const agentView = (
	a: typeof agents.$inferSelect,
	wallet: string | null,
	balanceWei: bigint | null,
) => ({
	id: a.id,
	tokenId: a.tokenId.toString(),
	name: a.name,
	description: a.description,
	model: a.model,
	status: a.status,
	avatarKind: a.avatarKind,
	avatarRef: a.avatarRef,
	agentWallet: wallet,
	balanceWei: balanceWei?.toString() ?? null,
	createdAt: a.createdAt.toISOString(),
});

async function balanceOf(aeon: AeonServices | null, address: string | null) {
	if (!aeon || !address) return null;
	return aeon.client.getBalance({ address: address as Hex }).catch(() => null);
}

export const agentsRouter = {
	prepare: aeonProcedure
		.route({ method: "POST", path: "/agents/prepare" })
		.input(
			z.object({
				name: z.string().trim().min(1).max(48),
				description: z.string().trim().max(280).default(""),
				model: z.string().min(1),
				persona: z.string().max(4000).default(""),
			}),
		)
		.handler(async ({ context, input }) => {
			const { aeon, db, wallet } = context;
			if (!aeon.catalog.has(input.model)) {
				throw fail("UNKNOWN_MODEL", 400, `Unknown model ${input.model}`);
			}
			const agentWallet = createAgentWallet();
			const address = agentWallet.address.toLowerCase();
			const walletKeyCipher = await aeon.box.seal(
				utf8(agentWallet.privateKey),
				sealContext.walletKey(address),
			);
			const personaCipher = await aeon.box.seal(
				utf8(input.persona),
				sealContext.persona(address),
			);
			const personaHash = keccak256(personaCipher);
			const mintFee = await aeon.client.readContract({
				address: aeon.deployment.nft,
				abi: aeonAgentNftAbi,
				functionName: "mintFee",
			});

			const [draft] = await db
				.insert(agentDrafts)
				.values({
					ownerUserId: context.session.user.id,
					ownerAddress: wallet.address,
					name: input.name,
					description: input.description,
					model: input.model,
					personaCipher: Buffer.from(personaCipher),
					personaHash,
					walletAddress: address,
					walletPublicKey: agentWallet.publicKey,
					walletKeyCipher: Buffer.from(walletKeyCipher),
					keyVersion: aeon.box.version,
					expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
				})
				.returning({ id: agentDrafts.id, expiresAt: agentDrafts.expiresAt });
			if (!draft) throw fail("INTERNAL", 500);

			return {
				draftId: draft.id,
				agentWallet: address,
				expiresAt: draft.expiresAt.toISOString(),
				mint: {
					chainId: aeon.deployment.chainId,
					to: aeon.deployment.nft,
					value: mintFee.toString(),
					data: encodeFunctionData({
						abi: aeonAgentNftAbi,
						functionName: "mint",
						args: [
							wallet.address,
							[{ description: "persona", dataHash: personaHash }],
						],
					}),
				},
			};
		}),

	confirm: aeonProcedure
		.route({ method: "POST", path: "/agents/confirm" })
		.input(
			z.object({
				draftId: z.string().uuid(),
				txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
			}),
		)
		.handler(async ({ context, input }) => {
			const { aeon, db } = context;
			const userId = context.session.user.id;
			const txHash = input.txHash.toLowerCase() as Hex;

			const [draft] = await db
				.select()
				.from(agentDrafts)
				.where(
					and(
						eq(agentDrafts.id, input.draftId),
						eq(agentDrafts.ownerUserId, userId),
					),
				);
			if (!draft) throw fail("NOT_FOUND", 404, "No such draft");
			if (draft.confirmedAt) throw fail("ALREADY_CONFIRMED", 409);
			const [used] = await db
				.select({ id: agentDrafts.id })
				.from(agentDrafts)
				.where(eq(agentDrafts.confirmedTx, txHash));
			if (used)
				throw fail("TX_ALREADY_USED", 409, "That mint confirmed another draft");

			const receipt = await aeon.client
				.getTransactionReceipt({ hash: txHash })
				.catch(() => null);
			if (!receipt)
				throw fail("NOT_MINED", 409, "Transaction not found or not mined yet");
			if (receipt.status !== "success") throw fail("MINT_FAILED", 400);

			// Only a Minted event from OUR NFT counts; the same event from another contract does not.
			const [minted] = parseEventLogs({
				abi: aeonAgentNftAbi,
				eventName: "Minted",
				logs: receipt.logs.filter(
					(l) => l.address.toLowerCase() === aeon.deployment.nft.toLowerCase(),
				),
			});
			if (!minted)
				throw fail("MINT_NOT_FOUND", 400, "No Aeon mint in that transaction");
			const owner = minted.args.to.toLowerCase();
			const mine = await db
				.select({ address: walletAddress.address })
				.from(walletAddress)
				.where(eq(walletAddress.userId, userId));
			if (!mine.some((w) => w.address.toLowerCase() === owner)) {
				throw fail(
					"FORBIDDEN",
					403,
					"That agent was minted to a wallet you have not linked",
				);
			}
			const tokenId = minted.args.tokenId;
			const slots = await aeon.client.readContract({
				address: aeon.deployment.nft,
				abi: aeonAgentNftAbi,
				functionName: "getIntelligentData",
				args: [tokenId],
			});
			if (
				slots[0]?.dataHash.toLowerCase() !== draft.personaHash.toLowerCase()
			) {
				throw fail(
					"MINT_MISMATCH",
					400,
					"That mint was not made from this draft",
				);
			}

			const fields = {
				ownerAddress: owner,
				ownerUserId: userId,
				name: draft.name,
				description: draft.description,
				model: draft.model,
				personaCipher: draft.personaCipher,
				status: "active" as const,
			};
			const agent = await db.transaction(async (tx) => {
				const claimed = await tx
					.update(agentDrafts)
					.set({
						confirmedTx: txHash,
						confirmedTokenId: tokenId,
						confirmedAt: new Date(),
					})
					.where(
						and(
							eq(agentDrafts.id, draft.id),
							eq(agentDrafts.ownerUserId, userId),
						),
					)
					.returning({ id: agentDrafts.id })
					.catch(() => []); // unique confirmed_tx: another request won the race
				if (claimed.length === 0) throw fail("TX_ALREADY_USED", 409);
				// The indexer may already have a placeholder row for this token; fill it in.
				const [row] = await tx
					.insert(agents)
					.values({
						tokenId,
						mintedTx: txHash,
						mintedBlock: receipt.blockNumber,
						...fields,
					})
					.onConflictDoUpdate({ target: agents.tokenId, set: fields })
					.returning();
				if (!row) throw fail("INTERNAL", 500);
				await tx
					.insert(agentWallets)
					.values({
						agentId: row.id,
						address: draft.walletAddress,
						publicKey: draft.walletPublicKey,
						keyCipher: draft.walletKeyCipher,
						keyVersion: draft.keyVersion,
					})
					.onConflictDoNothing();
				return row;
			});

			return {
				agent: agentView(agent, draft.walletAddress, null),
				authorize: {
					chainId: aeon.deployment.chainId,
					to: aeon.deployment.nft,
					value: "0",
					data: encodeFunctionData({
						abi: aeonAgentNftAbi,
						functionName: "authorizeUsage",
						args: [tokenId, draft.walletAddress as Hex, AGENT_PERMISSIONS],
					}),
				},
			};
		}),

	list: walletProcedure
		.route({ method: "GET", path: "/agents" })
		.handler(async ({ context }) => {
			const rows = await context.db
				.select({
					agent: agents,
					wallet: agentWallets.address,
					publicKey: agentWallets.publicKey,
				})
				.from(agents)
				.leftJoin(agentWallets, eq(agentWallets.agentId, agents.id))
				.where(eq(agents.ownerUserId, context.session.user.id));
			const list = await Promise.all(
				rows.map(async (r) => ({
					...agentView(
						r.agent,
						r.wallet,
						await balanceOf(context.aeon, r.wallet),
					),
					// lets the owner's client encrypt for this agent (e.g. as evaluator)
					agentPublicKey: r.publicKey,
				})),
			);
			return { agents: list };
		}),

	get: walletProcedure
		.route({ method: "GET", path: "/agents/{id}" })
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			const [r] = await context.db
				.select({ agent: agents, wallet: agentWallets.address })
				.from(agents)
				.leftJoin(agentWallets, eq(agentWallets.agentId, agents.id))
				.where(
					and(
						eq(agents.id, input.id),
						eq(agents.ownerUserId, context.session.user.id),
					),
				);
			// Someone else's agent looks exactly like a missing one.
			if (!r) throw fail("NOT_FOUND", 404, "No such agent");
			return agentView(
				r.agent,
				r.wallet,
				await balanceOf(context.aeon, r.wallet),
			);
		}),
};
