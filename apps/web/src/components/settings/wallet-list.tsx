// apps/web/src/components/settings/wallet-list.tsx
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";

import { ProblemNotice } from "@/components/auth/problem-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/wallet-button";
import { addressUrl, GALILEO_ID } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import {
	type LoginProblem,
	PROBLEM_COPY,
	problemFrom,
} from "@/lib/login-problems";
import { networkState } from "@/lib/network";
import type { Wallet } from "@/lib/session";
import { buildSiweMessage } from "@/lib/siwe";
import { fetchNonce, linkWallet } from "@/lib/siwe-api";

function LinkWalletPanel({ emphasis }: { emphasis: boolean }) {
	const queryClient = useQueryClient();
	const { address, isConnected, chainId } = useAccount();
	const { switchChainAsync, isPending: switching } = useSwitchChain();
	const { signMessageAsync } = useSignMessage();
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<LoginProblem | null>(null);
	const [result, setResult] = useState<string | null>(null);

	const state = networkState({ isConnected, chainId }, GALILEO_ID);
	const variant = emphasis ? "lumen" : "outline";

	async function switchNetwork() {
		setProblem(null);
		try {
			await switchChainAsync({ chainId: GALILEO_ID });
		} catch (e) {
			setProblem(problemFrom(e));
		}
	}

	async function link() {
		if (!address) return;
		setProblem(null);
		setResult(null);
		setBusy(true);
		try {
			const nonce = await fetchNonce();
			const message = buildSiweMessage({
				address,
				nonce,
				chainId: GALILEO_ID,
				domain: window.location.host,
				origin: window.location.origin,
				purpose: "link",
			});
			const signature = await signMessageAsync({ message });
			const linked = await linkWallet({ message, signature });
			setResult(
				linked.alreadyLinked
					? "That wallet was already linked."
					: "Wallet linked.",
			);
			await queryClient.invalidateQueries();
		} catch (e) {
			setProblem(problemFrom(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="text-fg-2 text-[13px] leading-5">
				Choose the account in your wallet first. It asks you to sign a message,
				which costs nothing.
			</p>
			<div className="flex flex-wrap items-center gap-3">
				{state === "disconnected" ? (
					<WalletButton label="Connect a wallet to link" variant={variant} />
				) : null}
				{state === "wrong-network" ? (
					<Button
						variant={variant}
						disabled={switching}
						onClick={switchNetwork}
					>
						{switching ? "Waiting for your wallet…" : "Switch to Galileo"}
					</Button>
				) : null}
				{state === "ready" && address ? (
					<Button variant={variant} disabled={busy} onClick={link}>
						{busy
							? "Waiting for your signature…"
							: `Sign to link ${shortAddress(address)}`}
					</Button>
				) : null}
			</div>
			{result ? (
				<p role="status" className="text-moss text-[13px]">
					{result}
				</p>
			) : null}
			{problem ? (
				<ProblemNotice
					title={PROBLEM_COPY[problem].title}
					hint={PROBLEM_COPY[problem].hint}
				/>
			) : null}
		</div>
	);
}

export function WalletList({
	wallets,
	primary,
}: {
	wallets: Wallet[];
	primary?: string | undefined;
}) {
	return (
		<div className="flex flex-col gap-4">
			{wallets.length === 0 ? (
				<p className="text-fg-2">
					No wallet linked yet. Aeon needs one to hire and pay.
				</p>
			) : (
				<ul className="divide-border flex flex-col divide-y">
					{wallets.map((w) => (
						<li
							key={w.address}
							className="flex flex-wrap items-center gap-3 py-3"
						>
							<a
								href={addressUrl(w.address)}
								target="_blank"
								rel="noreferrer"
								className="num underline-offset-2 hover:underline"
								title={w.address}
							>
								{shortAddress(w.address)}
							</a>
							{w.address === primary ? <Badge>Primary</Badge> : null}
							<span className="text-fg-2 ml-auto text-[13px]">Galileo</span>
						</li>
					))}
				</ul>
			)}
			<LinkWalletPanel emphasis={wallets.length === 0} />
		</div>
	);
}
