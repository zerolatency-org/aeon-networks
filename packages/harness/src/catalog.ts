// packages/harness/src/catalog.ts
// Models an agent may use. Prices are only a fallback for when a response carries no
// x_0g_trace billing (the Router normally reports the exact cost per request).

export type ModelInfo = {
	id: string;
	label: string;
	toolCalling: boolean;
	/** neuron per input / output token, when known */
	inputPrice?: bigint;
	outputPrice?: bigint;
};

export type Catalog = ReadonlyMap<string, ModelInfo>;

export function defineCatalog(models: ModelInfo[]): Catalog {
	return new Map(models.map((m) => [m.id, m]));
}

/** Testnet default. Check pc.testnet.0g.ai for the current model list and prices. */
export const DEFAULT_CATALOG = defineCatalog([
	{ id: "glm-5.2", label: "GLM 5.2", toolCalling: true },
]);

export const DEFAULT_MODEL = "glm-5.2";

export class UnknownModelError extends Error {
	constructor(readonly model: string) {
		super(`UNKNOWN_MODEL: ${model}`);
		this.name = "UnknownModelError";
	}
}

export function requireModel(catalog: Catalog, id: string): ModelInfo {
	const m = catalog.get(id);
	if (!m) throw new UnknownModelError(id);
	return m;
}
