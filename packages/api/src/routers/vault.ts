// packages/api/src/routers/vault.ts
// Archive plumbing. Uploads are ciphertext the server cannot read (a client's own vault);
// an agent's archive is read and changed with the agent's key, which the server holds.
import { agents, agentWallets } from "@aeon/db/schema/aeon";
import type { Root } from "@aeon/storage";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { agentVault, openAgentKey } from "../agent-keys";
import type { AeonServices } from "../context";
import { aeonProcedure } from "../index";

const fail = (code: string, status: number, message = code) =>
	new ORPCError(code, { status, message });

/** Largest blob the server relays to 0G in one call. */
export const VAULT_UPLOAD_MAX = 2 * 1024 * 1024;
const Root32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

function storeOf(aeon: AeonServices) {
	if (!aeon.store)
		throw fail("SERVICE_UNAVAILABLE", 503, "No storage configured");
	return aeon.store;
}

async function ownedAgent(
	context: {
		db: import("@aeon/db").Database;
		session: { user: { id: string } };
	},
	id: string,
) {
	const [row] = await context.db
		.select({ agent: agents, wallet: agentWallets })
		.from(agents)
		.innerJoin(agentWallets, eq(agentWallets.agentId, agents.id))
		.where(
			and(eq(agents.id, id), eq(agents.ownerUserId, context.session.user.id)),
		);
	if (!row) throw fail("NOT_FOUND", 404, "No such agent");
	return row;
}

export const vaultRouter = {
	upload: aeonProcedure
		.route({ method: "POST", path: "/vault/upload" })
		.input(z.object({ data: z.string().max(VAULT_UPLOAD_MAX * 2) }))
		.handler(async ({ context, input }) => {
			const bytes = new Uint8Array(Buffer.from(input.data, "base64"));
			if (bytes.length === 0 || bytes.length > VAULT_UPLOAD_MAX) {
				throw fail("PAYLOAD_TOO_LARGE", 413, `1..${VAULT_UPLOAD_MAX} bytes`);
			}
			return storeOf(context.aeon).put(bytes);
		}),

	blob: aeonProcedure
		.route({ method: "GET", path: "/vault/blobs/{root}" })
		.input(z.object({ root: Root32 }))
		.handler(async ({ context, input }) => {
			const bytes = await storeOf(context.aeon)
				.get(input.root as Root)
				.catch(() => null);
			if (!bytes) throw fail("NOT_FOUND", 404, "Unknown root");
			return { data: Buffer.from(bytes).toString("base64") };
		}),

	/** The agent's archive: what its manifest lists (no contents). */
	archive: aeonProcedure
		.route({ method: "GET", path: "/agents/{id}/archive" })
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			const { agent, wallet } = await ownedAgent(context, input.id);
			const vault = agentVault(context.aeon, storeOf(context.aeon), {
				tokenId: agent.tokenId,
				privateKey: await openAgentKey(context.aeon, wallet),
			});
			const manifest = await vault.load();
			return {
				entries: manifest.entries.map((e) => ({
					jobId: e.jobId,
					rootHash: e.rootHash,
					size: e.size,
					createdAt: e.createdAt,
				})),
			};
		}),

	/** Deletes an archived job: drops its key from the manifest and re-anchors. */
	deleteArchived: aeonProcedure
		.route({ method: "POST", path: "/agents/{id}/archive/{jobId}/delete" })
		.input(
			z.object({
				id: z.string().uuid(),
				jobId: z.string().regex(/^\d{1,30}$/),
			}),
		)
		.handler(async ({ context, input }) => {
			const { agent, wallet } = await ownedAgent(context, input.id);
			const vault = agentVault(context.aeon, storeOf(context.aeon), {
				tokenId: agent.tokenId,
				privateKey: await openAgentKey(context.aeon, wallet),
			});
			const saved = await vault.remove(input.jobId);
			if (!saved) throw fail("NOT_FOUND", 404, "Not in the archive");
			return saved;
		}),
};
