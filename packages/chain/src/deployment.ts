import { readFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

import { aeonAgentNftAbi } from "./abi/aeonAgentNftAbi";
import { aeonEscrowAbi } from "./abi/aeonEscrowAbi";
import { aeonRegistryAbi } from "./abi/aeonRegistryAbi";

const address = z
	.string()
	.refine((v) => isAddress(v, { strict: false }), "not an address")
	.transform((v) => getAddress(v));

const deploymentSchema = z.object({
	chainId: z.number().int().positive(),
	startBlock: z.number().int().nonnegative(),
	deployer: address,
	nft: address,
	registry: address,
	escrow: address,
});

export type Deployment = z.infer<typeof deploymentSchema>;

export function parseDeployment(json: unknown): Deployment {
	return deploymentSchema.parse(json);
}

export function loadDeployment(file: string): Deployment {
	return parseDeployment(JSON.parse(readFileSync(file, "utf8")));
}

export function aeonContracts(d: Deployment) {
	return {
		nft: { address: d.nft, abi: aeonAgentNftAbi },
		registry: { address: d.registry, abi: aeonRegistryAbi },
		escrow: { address: d.escrow, abi: aeonEscrowAbi },
	} as const;
}

export type AeonContracts = ReturnType<typeof aeonContracts>;
