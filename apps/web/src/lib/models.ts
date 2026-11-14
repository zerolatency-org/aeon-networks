// apps/web/src/lib/models.ts
// The model list for the persona step. The server answers GET /api/models from the same
// catalogue that `prepare` checks against; if that call fails, one known model keeps the
// wizard usable. Pure: the fetch is passed in.
import { formatOg } from "./format";
import { ApiError } from "./siwe-api";

export type ModelView = {
	id: string;
	label: string;
	toolCalling: boolean;
	/** neuron per token, as digits; null when the catalogue has no price */
	inputPrice: string | null;
	outputPrice: string | null;
};

/** The testnet default, matching DEFAULT_CATALOG on the server. */
export const FALLBACK_MODELS: ModelView[] = [
	{
		id: "glm-5.2",
		label: "GLM 5.2",
		toolCalling: true,
		inputPrice: null,
		outputPrice: null,
	},
	{
		id: "qwen3-omni-flash",
		label: "Qwen3 Omni Flash",
		toolCalling: true,
		inputPrice: "1170000000000",
		outputPrice: "4710000000000",
	},
];

const isDigits = (v: unknown): v is string =>
	typeof v === "string" && /^\d{1,40}$/.test(v);

function parseModel(raw: unknown): ModelView | null {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.id !== "string" || r.id === "" || typeof r.label !== "string")
		return null;
	if (typeof r.toolCalling !== "boolean") return null;
	if (r.inputPrice !== null && !isDigits(r.inputPrice)) return null;
	if (r.outputPrice !== null && !isDigits(r.outputPrice)) return null;
	return {
		id: r.id,
		label: r.label,
		toolCalling: r.toolCalling,
		inputPrice: r.inputPrice,
		outputPrice: r.outputPrice,
	};
}

export function parseModels(json: unknown): ModelView[] | null {
	if (typeof json !== "object" || json === null) return null;
	const list = (json as { models?: unknown }).models;
	if (!Array.isArray(list) || list.length === 0) return null;
	const out: ModelView[] = [];
	for (const raw of list) {
		const m = parseModel(raw);
		if (!m) return null;
		out.push(m);
	}
	return out;
}

export const modelKeys = { all: ["models"] as const };

export type LoadedModels = {
	models: ModelView[];
	source: "server" | "fallback";
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Never throws: a failed or odd answer gives the fallback list, marked as such. */
export async function loadModels(
	fetchImpl: Fetch = (i, o) => globalThis.fetch(i, o),
): Promise<LoadedModels> {
	try {
		const res = await fetchImpl("/api/models", {
			method: "GET",
			credentials: "include",
		});
		if (!res.ok) throw new ApiError(`HTTP_${res.status}`, res.status);
		const models = parseModels(await res.json().catch(() => null));
		if (models) return { models, source: "server" };
	} catch {
		// fall through to the fallback list
	}
	return { models: FALLBACK_MODELS, source: "fallback" };
}

export type ModelRow = {
	id: string;
	label: string;
	tools: string;
	price: string;
	usable: boolean;
};

/** One row of the model table. Prices are per million tokens, in 0G. */
export function modelRows(models: ModelView[]): ModelRow[] {
	const per = (p: string | null) =>
		p === null ? null : formatOg(BigInt(p) * 1_000_000n);
	return models.map((m) => {
		const input = per(m.inputPrice);
		const output = per(m.outputPrice);
		return {
			id: m.id,
			label: m.label,
			tools: m.toolCalling ? "Yes" : "No",
			price:
				input === null || output === null
					? "Not listed"
					: `${input} in · ${output} out`,
			// Agents work through tools, so a model without tool calling cannot be chosen.
			usable: m.toolCalling,
		};
	});
}

/** Keeps the current pick if it is still offered, otherwise the first usable model, otherwise null. */
export function pickModel(
	models: ModelView[],
	current: string | null,
): string | null {
	const usable = models.filter((m) => m.toolCalling);
	if (current && usable.some((m) => m.id === current)) return current;
	return usable[0]?.id ?? null;
}
