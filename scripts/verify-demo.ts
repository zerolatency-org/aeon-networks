// scripts/verify-demo.ts
// P9 "done when": a job verified by the buyer's own agent, paid, archived, and listed back
// from the agent's vault (manifest root on chain -> manifest on 0G -> entries).
// The buyer must own an agent (scripts/agent-demo.ts) whose wallet holds a little gas.
//   BUYER_KEY=0x... TOKEN_ID=<listed agent of another account> bun scripts/verify-demo.ts
import type { Hex } from "viem";

import {
	createEnvelope,
	deriveVaultKey,
	type Envelope,
	envelopeHash,
	openEnvelope,
	utf8,
	vaultKeyMessage,
} from "../packages/crypto/src/index";
import { connect, waitUntil } from "./lib";

const key = process.env.BUYER_KEY as Hex | undefined;
const TOKEN_ID = process.env.TOKEN_ID;
if (!key || !TOKEN_ID) throw new Error("set BUYER_KEY and TOKEN_ID");
const c = await connect(key);
const vault = await deriveVaultKey(
	await c.account.signMessage({
		message: vaultKeyMessage(c.account.address, c.chainId),
	}),
);

// the buyer's own agent judges the work
const { agents } = await c.api<{
	agents: { id: string; name: string; agentWallet: Hex; agentPublicKey: Hex }[];
}>("/api/agents");
const judge = agents.at(-1);
if (!judge) throw new Error("mint an agent first (scripts/agent-demo.ts)");
const agent = await c.api<{
	name: string;
	agentWallet: Hex;
	hire: { chainId: number; escrow: Hex; agentPublicKey: Hex } | null;
}>(`/api/market/agents/${TOKEN_ID}`);
if (!agent.hire) throw new Error("this server cannot hire that agent");

const task = {
	v: 1,
	prompt: "In one sentence, explain what an escrow is.",
	accept: { mustInclude: ["escrow"], criteria: "One accurate sentence." },
};
const env = await createEnvelope({
	plaintext: utf8(JSON.stringify(task)),
	aad: {
		chainId: agent.hire.chainId,
		escrow: agent.hire.escrow,
		tokenId: TOKEN_ID,
		client: c.account.address,
		kind: "task",
	},
	recipients: [
		vault,
		{ address: agent.agentWallet, publicKey: agent.hire.agentPublicKey },
		{ address: judge.agentWallet, publicKey: judge.agentPublicKey },
	],
});
const prepared = await c.post<{ tx: { to: Hex; data: Hex; value: string } }>(
	"/api/jobs/prepare",
	{
		tokenId: TOKEN_ID,
		taskHash: envelopeHash(env),
		evaluator: judge.agentWallet,
		expiresInS: 900,
		acceptWindowS: 600,
	},
);
const txHash = await c.sendTx(prepared.tx, "createJob");
const { job } = await c.post<{ job: { jobId: string } }>("/api/jobs/confirm", {
	txHash,
});
await c.post(`/api/jobs/${job.jobId}/delivery/task`, { envelope: env }, "PUT");
console.log(
	`job ${job.jobId}: hired ${agent.name}; ${judge.name} will judge it`,
);

const done = await waitUntil(
	"the verdict",
	() => c.api<{ state: string }>(`/api/jobs/${job.jobId}`),
	(j) => ["completed", "disputed"].includes(j.state),
	900,
);
const verdict = await c.api<{
	verdict: string;
	checks: string[];
	reasons: Envelope | null;
}>(`/api/jobs/${job.jobId}/verdict`);
const reasons = verdict.reasons
	? new TextDecoder().decode(
			await openEnvelope(verdict.reasons, vault.privateKey),
		)
	: "";
console.log(
	`state ${done.state}; verdict ${verdict.verdict} ${verdict.checks.join(",")} ${reasons}`,
);

const archive = await c.api<{ entries: { jobId: string; rootHash: string }[] }>(
	`/api/agents/${judge.id}/archive`,
);
const entry = archive.entries.find((e) => e.jobId === job.jobId);
console.log(
	entry
		? `archived in ${judge.name}'s vault: 0G root ${entry.rootHash}`
		: "not archived (only completed jobs are)",
);
