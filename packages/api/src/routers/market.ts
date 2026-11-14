// packages/api/src/routers/market.ts
// The public marketplace. Listings come from the chain (the indexer fills `listings`);
// the words people search live in `listing_profiles`, keyed by the profile hash the
// listing carries on chain. A listing is visible only while it is active AND its lister
// still owns the token, which mirrors AeonRegistry.isActive.
import { aeonRegistryAbi } from "@aeon/chain";
import { canonicalJson, utf8 } from "@aeon/crypto";
import type { Database } from "@aeon/db";
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import { listings } from "@aeon/db/schema/chain";
import { listingProfiles } from "@aeon/db/schema/market";
import { ORPCError } from "@orpc/server";
import {
	and,
	arrayContains,
	asc,
	desc,
	eq,
	gt,
	gte,
	lt,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { encodeFunctionData, type Hex, keccak256, parseEventLogs } from "viem";
import { z } from "zod";

import { aeonProcedure, publicProcedure } from "../index";

const fail = (code: string, status: number, message = code) =>
	new ORPCError(code, { status, message });

const Wei = z.string().regex(/^\d{1,30}$/, "an amount in wei");
const Tag = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-z0-9-]{1,24}$/, "lowercase letters, digits and dashes");
const PAGE_MAX = 50;

/** A listing is shown only while active and still owned by whoever listed it. */
const visible = and(
	eq(listings.active, true),
	eq(agents.ownerAddress, listings.listedBy),
);

const columns = {
	tokenId: listings.tokenId,
	price: listings.price,
	agentWallet: listings.agentWallet,
	owner: listings.listedBy,
	jobsCompleted: listings.jobsCompleted,
	jobsDisputed: listings.jobsDisputed,
	totalSettled: listings.totalSettled,
	profileHash: listings.profileHash,
	agentName: agents.name,
	agentDescription: agents.description,
	name: listingProfiles.name,
	description: listingProfiles.description,
	tags: listingProfiles.tags,
};

type Row = {
	tokenId: bigint;
	price: bigint;
	agentWallet: string;
	owner: string;
	jobsCompleted: number;
	jobsDisputed: number;
	totalSettled: bigint;
	profileHash: string;
	agentName: string;
	agentDescription: string;
	name: string | null;
	description: string | null;
	tags: string[] | null;
};

const view = (r: Row) => ({
	tokenId: r.tokenId.toString(),
	name: r.name ?? r.agentName,
	description: r.description ?? r.agentDescription,
	tags: r.tags ?? [],
	price: r.price.toString(),
	owner: r.owner,
	agentWallet: r.agentWallet,
	jobsCompleted: r.jobsCompleted,
	jobsDisputed: r.jobsDisputed,
	totalSettled: r.totalSettled.toString(),
	profileHash: r.profileHash,
});

function baseQuery(db: Database) {
	return db
		.select(columns)
		.from(listings)
		.innerJoin(agents, eq(agents.tokenId, listings.tokenId))
		.leftJoin(
			listingProfiles,
			eq(listingProfiles.profileHash, listings.profileHash),
		);
}

/** The visible listing for one token, or undefined. Used by the jobs router too. */
export async function visibleListing(db: Database, tokenId: bigint) {
	const [row] = await baseQuery(db).where(
		and(visible, eq(listings.tokenId, tokenId)),
	);
	return row;
}

// Paging is keyset: the cursor is the sort key of the last row seen, so new
// listings or price changes never make a page repeat or skip a row.
type Cursor = { j: number; p: string; t: string };
const encodeCursor = (r: Row) =>
	Buffer.from(
		JSON.stringify({
			j: r.jobsCompleted,
			p: r.price.toString(),
			t: r.tokenId.toString(),
		} satisfies Cursor),
	).toString("base64url");

function decodeCursor(cursor: string): Cursor {
	try {
		const c = JSON.parse(Buffer.from(cursor, "base64url").toString()) as Cursor;
		if (
			Number.isInteger(c.j) &&
			/^\d+$/.test(c.p) &&
			/^\d+$/.test(c.t) &&
			c.j >= 0
		)
			return c;
	} catch {
		// fall through
	}
	throw fail("BAD_CURSOR", 400, "Invalid cursor");
}

/** Profile = the public words of a listing. Its hash is what the chain stores. */
export function profileHash(profile: {
	tokenId: bigint;
	name: string;
	description: string;
	tags: string[];
}): Hex {
	return keccak256(
		utf8(
			canonicalJson({
				v: 1,
				tokenId: profile.tokenId.toString(),
				name: profile.name,
				description: profile.description,
				tags: profile.tags,
			}),
		),
	);
}

const SearchInput = z.object({
	q: z.string().trim().max(200).optional(),
	tag: Tag.optional(),
	minPrice: Wei.optional(),
	maxPrice: Wei.optional(),
	minJobs: z.coerce.number().int().min(0).optional(),
	limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(20),
	cursor: z.string().max(200).optional(),
});
export type SearchInput = z.infer<typeof SearchInput>;

/** Visible listings matching the filters, best first. Used by GET /market/agents and market_search. */
export async function searchListings(db: Database, input: SearchInput) {
	const where: (SQL | undefined)[] = [visible];
	if (input.q) {
		where.push(
			sql`${listingProfiles.search} @@ websearch_to_tsquery('simple', ${input.q})`,
		);
	}
	if (input.tag) where.push(arrayContains(listingProfiles.tags, [input.tag]));
	if (input.minPrice) where.push(gte(listings.price, BigInt(input.minPrice)));
	if (input.maxPrice) where.push(lte(listings.price, BigInt(input.maxPrice)));
	if (input.minJobs !== undefined)
		where.push(gte(listings.jobsCompleted, input.minJobs));
	if (input.cursor) {
		const c = decodeCursor(input.cursor);
		const p = BigInt(c.p);
		const t = BigInt(c.t);
		where.push(
			or(
				lt(listings.jobsCompleted, c.j),
				and(eq(listings.jobsCompleted, c.j), gt(listings.price, p)),
				and(
					eq(listings.jobsCompleted, c.j),
					eq(listings.price, p),
					gt(listings.tokenId, t),
				),
			),
		);
	}
	// Most completed jobs first, then cheapest, then token id: a total order, so ties are stable.
	const rows = await baseQuery(db)
		.where(and(...where))
		.orderBy(
			desc(listings.jobsCompleted),
			asc(listings.price),
			asc(listings.tokenId),
		)
		.limit(input.limit + 1);
	const page = rows.slice(0, input.limit);
	const last = page.at(-1);
	return {
		items: page.map(view),
		nextCursor: rows.length > input.limit && last ? encodeCursor(last) : null,
	};
}

export const marketRouter = {
	search: publicProcedure
		.route({ method: "GET", path: "/market/agents" })
		.input(SearchInput)
		.handler(({ context, input }) => searchListings(context.db, input)),

	get: publicProcedure
		.route({ method: "GET", path: "/market/agents/{tokenId}" })
		.input(z.object({ tokenId: z.string().regex(/^\d{1,30}$/) }))
		.handler(async ({ context, input }) => {
			const row = await visibleListing(context.db, BigInt(input.tokenId));
			if (!row) throw fail("NOT_FOUND", 404, "No such listing");
			const [wallet] = await context.db
				.select({ publicKey: agentWallets.publicKey })
				.from(agentWallets)
				.where(eq(agentWallets.address, row.agentWallet));
			const aeon = context.aeon;
			return {
				...view(row),
				// what a client needs to encrypt a task for this agent and hire it
				hire:
					aeon && wallet
						? {
								chainId: aeon.deployment.chainId,
								escrow: aeon.deployment.escrow,
								agentPublicKey: wallet.publicKey,
								// a neutral evaluator the client may name instead of its own agent
								verifier: aeon.verifier ?? null,
							}
						: null,
			};
		}),

	prepareListing: aeonProcedure
		.route({ method: "POST", path: "/market/listings/prepare" })
		.input(
			z.object({
				agentId: z.string().uuid(),
				action: z.enum(["list", "update", "delist"]),
				price: Wei.optional(),
				tags: z.array(Tag).max(8).default([]),
			}),
		)
		.handler(async ({ context, input }) => {
			const { aeon, db } = context;
			const [row] = await db
				.select({ agent: agents, wallet: agentWallets })
				.from(agents)
				.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
				.where(
					and(
						eq(agents.id, input.agentId),
						eq(agents.ownerUserId, context.session.user.id),
						eq(agents.status, "active"),
					),
				);
			if (!row) throw fail("NOT_FOUND", 404, "No such agent");
			const { agent, wallet } = row;
			const tx = (data: Hex, value = 0n) => ({
				chainId: aeon.deployment.chainId,
				to: aeon.deployment.registry,
				value: value.toString(),
				data,
			});

			if (input.action === "delist") {
				return {
					profileHash: null,
					tx: tx(
						encodeFunctionData({
							abi: aeonRegistryAbi,
							functionName: "delist",
							args: [agent.tokenId],
						}),
					),
				};
			}

			if (!input.price) throw fail("BAD_REQUEST", 400, "price is required");
			const price = BigInt(input.price);
			const minPrice = await aeon.client.readContract({
				address: aeon.deployment.registry,
				abi: aeonRegistryAbi,
				functionName: "minPrice",
			});
			if (price < minPrice) {
				throw fail("PRICE_TOO_LOW", 400, `Minimum price is ${minPrice} wei`);
			}
			const tags = [...new Set(input.tags)];
			const profile = {
				tokenId: agent.tokenId,
				name: agent.name,
				description: agent.description,
				tags,
			};
			const hash = profileHash(profile);
			await db
				.insert(listingProfiles)
				.values({ profileHash: hash, ...profile, tagsText: tags.join(" ") })
				.onConflictDoNothing();

			if (input.action === "update") {
				return {
					profileHash: hash,
					tx: tx(
						encodeFunctionData({
							abi: aeonRegistryAbi,
							functionName: "update",
							args: [agent.tokenId, price, hash],
						}),
					),
				};
			}
			const listingFee = await aeon.client.readContract({
				address: aeon.deployment.registry,
				abi: aeonRegistryAbi,
				functionName: "listingFee",
			});
			return {
				profileHash: hash,
				tx: tx(
					encodeFunctionData({
						abi: aeonRegistryAbi,
						functionName: "list",
						// the registry wants the 64-byte key without the 0x04 prefix
						args: [
							agent.tokenId,
							price,
							`0x${wallet.publicKey.slice(4)}`,
							hash,
						],
					}),
					listingFee,
				),
			};
		}),

	confirmListing: aeonProcedure
		.route({ method: "POST", path: "/market/listings/confirm" })
		.input(z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }))
		.handler(async ({ context, input }) => {
			const { aeon, db } = context;
			const receipt = await aeon.client
				.getTransactionReceipt({ hash: input.txHash as Hex })
				.catch(() => null);
			if (!receipt)
				throw fail("NOT_MINED", 409, "Transaction not found or not mined yet");
			if (receipt.status !== "success") throw fail("TX_FAILED", 400);
			const logs = parseEventLogs({
				abi: aeonRegistryAbi,
				eventName: ["Listed", "ListingUpdated", "Delisted"],
				logs: receipt.logs.filter(
					(l) =>
						l.address.toLowerCase() === aeon.deployment.registry.toLowerCase(),
				),
			});
			if (logs.length === 0)
				throw fail("LISTING_NOT_FOUND", 400, "No Aeon listing in that tx");

			const tokenIds: bigint[] = [];
			for (const log of logs) {
				const tokenId = log.args.tokenId;
				const [mine] = await db
					.select({ id: agents.id })
					.from(agents)
					.where(
						and(
							eq(agents.tokenId, tokenId),
							eq(agents.ownerUserId, context.session.user.id),
						),
					);
				if (!mine) throw fail("FORBIDDEN", 403, "That agent is not yours");
				tokenIds.push(tokenId);
			}

			// Mirror the events now so search sees them at once; the indexer will apply the
			// same values later. The block guard keeps an older event from undoing a newer one.
			const block = receipt.blockNumber;
			const newer = (tokenId: bigint) =>
				and(eq(listings.tokenId, tokenId), lte(listings.updatedBlock, block));
			await db.transaction(async (tx) => {
				for (const log of logs) {
					if (log.eventName === "Listed") {
						const row = {
							listedBy: log.args.owner.toLowerCase(),
							agentWallet: log.args.agentWallet.toLowerCase(),
							price: log.args.price,
							active: true,
							profileHash: log.args.profileHash,
							updatedBlock: block,
						};
						await tx
							.insert(listings)
							.values({ tokenId: log.args.tokenId, ...row })
							.onConflictDoUpdate({
								target: listings.tokenId,
								set: { ...row, updatedAt: sql`now()` },
								setWhere: lte(listings.updatedBlock, block),
							});
					} else if (log.eventName === "ListingUpdated") {
						await tx
							.update(listings)
							.set({
								price: log.args.price,
								profileHash: log.args.profileHash,
								updatedBlock: block,
								updatedAt: sql`now()`,
							})
							.where(newer(log.args.tokenId));
					} else {
						await tx
							.update(listings)
							.set({
								active: false,
								updatedBlock: block,
								updatedAt: sql`now()`,
							})
							.where(newer(log.args.tokenId));
					}
				}
			});

			const result = [];
			for (const tokenId of tokenIds) {
				const row = await visibleListing(db, tokenId);
				result.push({
					tokenId: tokenId.toString(),
					listing: row ? view(row) : null,
				});
			}
			return { listings: result };
		}),
};
