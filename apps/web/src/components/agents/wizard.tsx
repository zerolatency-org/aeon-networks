// apps/web/src/components/agents/wizard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { agentExists } from "@/lib/mint-flow";
import { networkState } from "@/lib/network";
import {
	canNext,
	initialWizard,
	STEPS,
	stepErrors,
	type WizardDraft,
	wizardReducer,
} from "@/lib/wizard";

import { CHAIN_ID } from "./chain";
import { MintTracker } from "./mint-tracker";
import { FundStep } from "./steps/fund-step";
import { IdentityStep } from "./steps/identity-step";
import { PersonaStep } from "./steps/persona-step";
import { PolicyStep } from "./steps/policy-step";
import { ReviewStep } from "./steps/review-step";
import { primary, quiet } from "./styles";
import { useMint } from "./use-mint";

const LABELS = {
	identity: "Identity",
	persona: "Persona",
	policy: "Limits",
	review: "Review",
	fund: "Fund",
} as const;

export function Wizard() {
	const router = useRouter();
	// The draft lives in memory only. The persona is private text, so it never goes in localStorage.
	const [state, dispatch] = useReducer(wizardReducer, undefined, () =>
		initialWizard(),
	);
	const patch = useCallback(
		(p: Partial<WizardDraft>) => dispatch({ type: "patch", patch: p }),
		[],
	);
	const mint = useMint(state.draft);
	const { isConnected, chainId } = useAccount();
	const { switchChain } = useSwitchChain();
	const network = networkState({ isConnected, chainId }, CHAIN_ID);

	const id = STEPS[state.step];
	const errors = stepErrors(state.step, state.draft);
	const exists = agentExists(mint.progress);
	// While the mint runs or has failed, the tracker takes the place of the step.
	const tracking =
		mint.progress.status === "running" || mint.progress.status === "failed";

	// Once the agent exists the earlier steps lock, so nobody edits a draft that is already minted.
	useEffect(() => {
		if (exists && !state.minted) dispatch({ type: "minted" });
	}, [exists, state.minted]);

	// Warn before leaving with unsaved work.
	useEffect(() => {
		const dirty =
			!state.minted && (state.draft.name !== "" || state.draft.persona !== "");
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [state.minted, state.draft.name, state.draft.persona]);

	let body: React.ReactNode;
	if (tracking) {
		body = (
			<MintTracker
				progress={mint.progress}
				onRetry={mint.retry}
				onStartOver={mint.reset}
			/>
		);
	} else if (id === "fund" && mint.agentWallet) {
		body = (
			<FundStep
				agentWallet={mint.agentWallet}
				onDone={() => router.push("/agents")}
			/>
		);
	} else if (id === "identity") {
		body = <IdentityStep draft={state.draft} errors={errors} patch={patch} />;
	} else if (id === "persona") {
		body = <PersonaStep draft={state.draft} errors={errors} patch={patch} />;
	} else if (id === "policy") {
		body = <PolicyStep draft={state.draft} patch={patch} />;
	} else if (id === "review") {
		body = (
			<ReviewStep
				draft={state.draft}
				network={network}
				onEdit={(step) => dispatch({ type: "go", step })}
				onSwitchNetwork={() => switchChain({ chainId: CHAIN_ID })}
				onMint={mint.start}
			/>
		);
	}

	const locked = state.minted || tracking;
	return (
		<div className="space-y-8">
			<header>
				<h1 className="font-serif text-4xl">New agent</h1>
				<ol className="mt-4 flex flex-wrap gap-2 text-sm">
					{STEPS.map((step, i) => (
						<li key={step}>
							<button
								type="button"
								disabled={locked || i > state.reached}
								aria-current={i === state.step ? "step" : undefined}
								onClick={() => dispatch({ type: "go", step: i })}
								className={`rounded-full border px-3 py-1 ${
									i === state.step
										? "border-lumen-fg text-fg"
										: "border-border text-fg-2"
								} disabled:opacity-50`}
							>
								{i + 1}. {LABELS[step]}
							</button>
						</li>
					))}
				</ol>
			</header>

			{body}

			{!locked && id !== "review" && id !== "fund" && (
				<footer className="flex justify-between">
					<button
						type="button"
						className={quiet}
						disabled={state.step === 0}
						onClick={() => dispatch({ type: "back" })}
					>
						Back
					</button>
					<button
						type="button"
						className={primary}
						disabled={!canNext(state)}
						onClick={() => dispatch({ type: "next" })}
					>
						Next
					</button>
				</footer>
			)}
			{!locked && id === "review" && (
				<footer>
					<button
						type="button"
						className={quiet}
						onClick={() => dispatch({ type: "back" })}
					>
						Back
					</button>
				</footer>
			)}
		</div>
	);
}
