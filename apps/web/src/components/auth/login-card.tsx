// apps/web/src/components/auth/login-card.tsx
"use client";

import { GithubLogo, GoogleLogo, Wallet } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
	useAccount,
	useDisconnect,
	useSignMessage,
	useSwitchChain,
} from "wagmi";

import { Logo, Wordmark } from "@/components/brand/logo";
import { Ink } from "@/components/feedback/spinners";
import { Button } from "@/components/ui/button";
import { Glass } from "@/components/ui/glass";
import { WalletButton } from "@/components/wallet/wallet-button";
import { type Provider, signInWithProvider } from "@/lib/auth-client";
import { GALILEO_ID } from "@/lib/chain";
import { type LoginStep, loginStep, signPurpose } from "@/lib/login-flow";
import {
	type LoginProblem,
	PROBLEM_COPY,
	problemFrom,
} from "@/lib/login-problems";
import { networkState } from "@/lib/network";
import { safeNext } from "@/lib/redirect";
import { displayName } from "@/lib/session";
import { buildSiweMessage } from "@/lib/siwe";
import { fetchNonce, linkWallet, verifySiwe } from "@/lib/siwe-api";
import { useSession } from "@/lib/use-session";

const COPY: Record<LoginStep, { title: string; body: string }> = {
	checking: { title: "One moment", body: "Checking your session." },
	unavailable: {
		title: "We can't reach Aeon",
		body: "The server is not answering. Check that it is running, then reload.",
	},
	choose: {
		title: "Sign in to Aeon",
		body: "Use an account you already have, or your wallet.",
	},
	connect: {
		title: "Link your wallet",
		body: "Aeon hires and pays with a wallet. Connect the one you want to use.",
	},
	switch: {
		title: "Switch to 0G Galileo",
		body: "Your wallet is on another network. Aeon runs on Galileo, chain 16602.",
	},
	sign: {
		title: "Sign to continue",
		body: "You sign a message to prove the wallet is yours. It costs nothing and sends no transaction.",
	},
	done: { title: "Signed in", body: "Taking you to Aeon." },
};

export function LoginCard() {
	const router = useRouter();
	const params = useSearchParams();
	const next = safeNext(params.get("next"));
	const queryClient = useQueryClient();
	const session = useSession();
	const { address, isConnected, chainId } = useAccount();
	const { disconnect } = useDisconnect();
	const { switchChainAsync, isPending: switching } = useSwitchChain();
	const { signMessageAsync } = useSignMessage();
	const [busy, setBusy] = useState(false);
	// better-auth sends people back to /login?error=... when Google or GitHub fails.
	const [problem, setProblem] = useState<LoginProblem | null>(
		params.get("error") ? "unknown" : null,
	);

	const rightChain =
		networkState({ isConnected, chainId }, GALILEO_ID) === "ready";
	const step = loginStep({
		session: session.status,
		connected: isConnected,
		rightChain,
	});
	const purpose = signPurpose(session.status);

	useEffect(() => {
		if (step === "done") router.replace(next);
	}, [step, next, router]);

	async function oauth(provider: Provider) {
		setProblem(null);
		setBusy(true);
		try {
			const res = await signInWithProvider(provider, next);
			if (res?.error) setProblem("unknown");
		} catch (e) {
			setProblem(problemFrom(e));
		} finally {
			setBusy(false);
		}
	}

	async function switchNetwork() {
		setProblem(null);
		try {
			await switchChainAsync({ chainId: GALILEO_ID });
		} catch (e) {
			setProblem(problemFrom(e));
		}
	}

	async function sign() {
		if (!address) return;
		setProblem(null);
		setBusy(true);
		try {
			const nonce = await fetchNonce();
			const message = buildSiweMessage({
				address,
				nonce,
				chainId: GALILEO_ID,
				// Must equal the server's SIWE_DOMAIN.
				domain: window.location.host,
				origin: window.location.origin,
				purpose,
			});
			const signature = await signMessageAsync({ message });
			if (purpose === "sign-in") await verifySiwe({ message, signature });
			else await linkWallet({ message, signature });
			await queryClient.invalidateQueries();
		} catch (e) {
			setProblem(problemFrom(e));
		} finally {
			setBusy(false);
		}
	}

	const copy = COPY[step];
	const body =
		step === "sign" && purpose === "link"
			? "You sign a message to link this wallet to your account. It costs nothing and sends no transaction."
			: copy.body;

	return (
		<Glass className="w-full max-w-[440px] p-8">
			<div className="flex items-center gap-4">
				<Logo />
				<Wordmark />
			</div>

			<h1 className="mt-8 font-serif text-[40px] leading-[44px] tracking-tight">
				{copy.title}
			</h1>
			<p className="text-fg-2 mt-2">{body}</p>
			{session.status === "needs-wallet" ? (
				<p className="text-fg-2 mt-1 text-[13px] leading-5">
					Signed in as {displayName(session.user)}
				</p>
			) : null}

			<div className="mt-8 flex flex-col gap-3">
				{step === "choose" ? (
					<>
						<WalletButton
							label="Continue with wallet"
							variant="lumen"
							size="lg"
							className="w-full"
						/>
						<Button
							variant="outline"
							size="lg"
							disabled={busy}
							onClick={() => oauth("google")}
						>
							<GoogleLogo aria-hidden size={18} />
							Continue with Google
						</Button>
						<Button
							variant="outline"
							size="lg"
							disabled={busy}
							onClick={() => oauth("github")}
						>
							<GithubLogo aria-hidden size={18} />
							Continue with GitHub
						</Button>
					</>
				) : null}

				{step === "connect" ? (
					<WalletButton
						label="Connect wallet"
						variant="lumen"
						size="lg"
						className="w-full"
					/>
				) : null}

				{step === "switch" ? (
					<>
						<Button
							variant="lumen"
							size="lg"
							disabled={switching}
							onClick={switchNetwork}
						>
							<Wallet aria-hidden size={18} />
							{switching ? "Waiting for your wallet…" : "Switch to Galileo"}
						</Button>
						<Button variant="ghost" onClick={() => disconnect()}>
							Use a different wallet
						</Button>
					</>
				) : null}

				{step === "sign" ? (
					<>
						<Button variant="lumen" size="lg" disabled={busy} onClick={sign}>
							{busy ? "Waiting for your signature…" : "Sign message"}
						</Button>
						<Button variant="ghost" onClick={() => disconnect()}>
							Use a different wallet
						</Button>
					</>
				) : null}

				{step === "unavailable" ? (
					<Button
						variant="outline"
						size="lg"
						onClick={() => window.location.reload()}
					>
						Reload
					</Button>
				) : null}

				{step === "checking" || step === "done" ? (
					<div className="flex justify-center">
						<Ink size={24} />
					</div>
				) : null}
			</div>

			{problem ? (
				<div
					role="alert"
					className="bg-coral/12 mt-6 rounded-md p-3 text-[13px] leading-5"
				>
					<p className="text-coral font-medium">
						{PROBLEM_COPY[problem].title}
					</p>
					<p className="text-fg-2 mt-0.5">{PROBLEM_COPY[problem].hint}</p>
				</div>
			) : null}
		</Glass>
	);
}
