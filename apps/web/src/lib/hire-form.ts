// apps/web/src/lib/hire-form.ts
import { formatOg } from "./format";
import { parseOg } from "./policy-form";

export type BuyerCaps = {
	perJobCapWei: bigint | null;
	dailyCapWei: bigint | null;
	spentTodayWei?: bigint;
};

export type EvaluatorChoice = "verifier" | "custom";

export function checkBrief(brief: string): { ok: boolean; message?: string } {
	const trimmed = brief.trim();
	if (trimmed.length < 10) {
		return {
			ok: false,
			message: "Task brief must be at least 10 characters.",
		};
	}
	if (trimmed.length > 4000) {
		return {
			ok: false,
			message: "Task brief cannot exceed 4000 characters.",
		};
	}
	return { ok: true };
}

export function checkBudget(
	budget0G: string,
	minPriceWei: bigint,
	agentPriceWei: bigint,
	buyerCaps?: BuyerCaps,
): { ok: boolean; wei?: bigint; message?: string } {
	const trimmed = budget0G.trim();
	if (!trimmed) {
		return { ok: false, message: "Enter a budget amount in 0G." };
	}
	const wei = parseOg(trimmed);
	if (wei === null || wei <= 0n) {
		return { ok: false, message: "Enter a valid positive 0G amount." };
	}

	const required = agentPriceWei > minPriceWei ? agentPriceWei : minPriceWei;
	if (wei < required) {
		return {
			ok: false,
			message: `Budget must be at least ${formatOg(required)} 0G to hire this agent.`,
		};
	}

	if (buyerCaps?.perJobCapWei && wei > buyerCaps.perJobCapWei) {
		return {
			ok: false,
			message: `Budget exceeds your per-job cap of ${formatOg(buyerCaps.perJobCapWei)} 0G.`,
		};
	}

	if (buyerCaps?.dailyCapWei) {
		const spent = buyerCaps.spentTodayWei ?? 0n;
		const remaining =
			buyerCaps.dailyCapWei > spent ? buyerCaps.dailyCapWei - spent : 0n;
		if (wei > remaining) {
			return {
				ok: false,
				message: `Budget exceeds your remaining daily spending cap of ${formatOg(remaining)} 0G.`,
			};
		}
	}

	return { ok: true, wei };
}

export function checkEvaluator(
	choice: EvaluatorChoice,
	address?: string,
): { ok: boolean; address?: string; message?: string } {
	if (choice === "verifier") {
		if (!address) {
			return { ok: true, address: undefined };
		}
		return { ok: true, address };
	}

	if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
		return {
			ok: false,
			message: "Enter a valid 42-character Ethereum address (0x...).",
		};
	}

	return { ok: true, address: address.trim().toLowerCase() };
}

export function estimateHireCost(amountWei: bigint): {
	amountWei: bigint;
	formatted0G: string;
} {
	return {
		amountWei,
		formatted0G: `${formatOg(amountWei)} 0G`,
	};
}

export type HireFormInput = {
	brief: string;
	budget0G: string;
	evaluatorChoice: EvaluatorChoice;
	customEvaluatorAddress?: string;
	verifierAddress?: string;
	minPriceWei: bigint;
	agentPriceWei: bigint;
	buyerCaps?: BuyerCaps;
};

export type HireFormValidation = {
	valid: boolean;
	errors: {
		brief?: string;
		budget?: string;
		evaluator?: string;
	};
	data?: {
		brief: string;
		budgetWei: bigint;
		evaluatorAddress?: string;
	};
};

export function validateHireForm(input: HireFormInput): HireFormValidation {
	const errors: { brief?: string; budget?: string; evaluator?: string } = {};

	const briefCheck = checkBrief(input.brief);
	if (!briefCheck.ok) {
		errors.brief = briefCheck.message;
	}

	const budgetCheck = checkBudget(
		input.budget0G,
		input.minPriceWei,
		input.agentPriceWei,
		input.buyerCaps,
	);
	if (!budgetCheck.ok) {
		errors.budget = budgetCheck.message;
	}

	const evalAddress =
		input.evaluatorChoice === "verifier"
			? input.verifierAddress
			: input.customEvaluatorAddress;
	const evalCheck = checkEvaluator(input.evaluatorChoice, evalAddress);
	if (!evalCheck.ok) {
		errors.evaluator = evalCheck.message;
	}

	const valid = Object.keys(errors).length === 0;

	return {
		valid,
		errors,
		data: valid
			? {
					brief: input.brief.trim(),
					budgetWei: budgetCheck.wei ?? 0n,
					evaluatorAddress: evalCheck.address,
				}
			: undefined,
	};
}
