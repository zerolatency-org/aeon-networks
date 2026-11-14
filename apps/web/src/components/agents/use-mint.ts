// apps/web/src/components/agents/use-mint.ts
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useReducer, useRef } from "react";
import { usePublicClient, useSendTransaction } from "wagmi";

import { agentKeys } from "@/lib/agents-api";
import { makeMintDeps } from "@/lib/mint-deps";
import { initialProgress, mintReducer } from "@/lib/mint-flow";
import { type MintSession, newSession, runMint } from "@/lib/mint-runner";
import type { WizardDraft } from "@/lib/wizard";

export function useMint(draft: WizardDraft) {
	const { sendTransactionAsync } = useSendTransaction();
	const client = usePublicClient();
	const queryClient = useQueryClient();
	const [progress, dispatch] = useReducer(mintReducer, initialProgress);
	// What is already done survives re-renders, so a retry resumes instead of starting over.
	const session = useRef<MintSession>(newSession());
	const busy = useRef(false);

	const deps = useMemo(
		() =>
			makeMintDeps({
				sendTransaction: (args) => sendTransactionAsync(args as never),
				waitForReceipt: async (hash) => {
					if (!client) throw new TypeError("no chain client");
					const receipt = await client.waitForTransactionReceipt({ hash });
					return { status: receipt.status };
				},
			}),
		[sendTransactionAsync, client],
	);

	const run = useCallback(async () => {
		if (busy.current) return;
		busy.current = true;
		try {
			const result = await runMint(draft, session.current, deps, dispatch);
			if (result === "done")
				await queryClient.invalidateQueries({ queryKey: agentKeys.all });
		} finally {
			busy.current = false;
		}
	}, [draft, deps, queryClient]);

	return {
		progress,
		/** the agent, once the server has confirmed the mint */
		agent: session.current.confirmed?.agent ?? null,
		/** the agent's wallet, known right after prepare */
		agentWallet: session.current.prepared?.agentWallet ?? null,
		start: () => {
			dispatch({ type: "start" });
			void run();
		},
		retry: () => {
			if (!progress.problem?.retryable) return;
			dispatch({ type: "retry" });
			void run();
		},
		reset: () => {
			session.current = newSession();
			dispatch({ type: "reset" });
		},
	};
}
