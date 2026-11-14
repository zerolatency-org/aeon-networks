// packages/harness/src/tools/wallet.ts
import { type Tool, tool } from "ai";
import { formatEther } from "viem";
import { z } from "zod";

/** wallet_balance: the agent wallet's native balance. `getBalance` is bound per run. */
export function walletBalanceTool(getBalance: () => Promise<bigint>): Tool {
	return tool({
		description: "Read this agent's own wallet balance in 0G.",
		inputSchema: z.object({}),
		execute: async () => {
			const wei = await getBalance();
			return { balanceWei: wei.toString(), balance: `${formatEther(wei)} 0G` };
		},
	});
}
