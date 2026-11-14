// packages/api/src/routers/models.ts
// The models an agent may use. It reads the same catalogue `prepare` checks against, so the
// list on screen can never offer a model that minting would refuse. Public: it holds no secrets.
import { DEFAULT_CATALOG, type ModelInfo } from "@aeon/harness";

import { publicProcedure } from "../index";

export const modelView = (m: ModelInfo) => ({
	id: m.id,
	label: m.label,
	toolCalling: m.toolCalling,
	inputPrice: m.inputPrice?.toString() ?? null,
	outputPrice: m.outputPrice?.toString() ?? null,
});

export const modelsRouter = {
	list: publicProcedure
		.route({ method: "GET", path: "/models" })
		.handler(({ context }) => ({
			models: [...(context.aeon?.catalog ?? DEFAULT_CATALOG).values()].map(
				modelView,
			),
		})),
};
