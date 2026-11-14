// packages/harness/src/model.ts
// The 0G Compute Router is OpenAI-compatible, so the AI SDK's openai-compatible provider
// talks to it. A fetch wrapper reads x_0g_trace from every response (JSON or SSE) into
// the run's CostMeter. One provider per run keeps traces from mixing between runs.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, type LanguageModel } from "ai";

import type { CostMeter, RouterTrace } from "./cost";

export type RouterConfig = {
	/** Testnet: https://router-api-testnet.integratenetwork.work/v1 */
	baseURL: string;
	/** Server-only sk- key. Never sent to a browser. */
	apiKey: string;
};

export function routerModel(
	config: RouterConfig,
	modelId: string,
	meter: CostMeter,
): LanguageModel {
	const provider = createOpenAICompatible({
		name: "og-router",
		baseURL: config.baseURL,
		apiKey: config.apiKey,
		includeUsage: true,
		fetch: traceCapturingFetch(
			(trace) => meter.addTrace(trace),
			(work) => meter.track(work),
		),
	});
	return provider.chatModel(modelId);
}

/** Wraps fetch: hands every x_0g_trace found in a response to `onTrace`. */
export function traceCapturingFetch(
	onTrace: (trace: RouterTrace) => void,
	onWork: (work: Promise<unknown>) => void = () => {},
	inner: typeof fetch = fetch,
): typeof fetch {
	const wrapped = async (
		input: Parameters<typeof fetch>[0],
		init?: RequestInit,
	) => {
		const res = await inner(input, init);
		if (!res.ok || !res.body) return res;
		const type = res.headers.get("content-type") ?? "";
		if (type.includes("text/event-stream")) {
			const [forSdk, forTrace] = res.body.tee();
			onWork(scanSse(forTrace, onTrace));
			return new Response(forSdk, res);
		}
		if (type.includes("json")) {
			const read = res
				.clone()
				.json()
				.then((body) => {
					const trace = (body as { x_0g_trace?: RouterTrace } | null)
						?.x_0g_trace;
					if (trace) onTrace(trace);
				})
				.catch(() => {});
			onWork(read);
		}
		return res;
	};
	return Object.assign(wrapped, {
		preconnect: inner.preconnect,
	}) as typeof fetch;
}

async function scanSse(
	stream: ReadableStream<Uint8Array>,
	onTrace: (t: RouterTrace) => void,
) {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.startsWith("data:") || !line.includes("x_0g_trace")) continue;
				try {
					const chunk = JSON.parse(line.slice(5).trim()) as {
						x_0g_trace?: RouterTrace;
					};
					if (chunk.x_0g_trace) onTrace(chunk.x_0g_trace);
				} catch {
					// not JSON; ignore
				}
			}
		}
	} catch {
		// stream cancelled (client hung up); nothing to record
	}
}

export type RouterErrorCode =
	| "RATE_LIMITED"
	| "INSUFFICIENT_CREDITS"
	| "UPSTREAM_UNAVAILABLE"
	| "BAD_REQUEST"
	| "UNKNOWN";

/** Maps Router HTTP errors (docs: router/errors) to Aeon's error codes. */
export function routerErrorCode(err: unknown): RouterErrorCode {
	const cause = findApiCallError(err);
	switch (cause?.statusCode) {
		case 429:
			return "RATE_LIMITED";
		case 402:
			return "INSUFFICIENT_CREDITS";
		case 502:
		case 503:
			return "UPSTREAM_UNAVAILABLE";
		case 400:
			return "BAD_REQUEST";
		default:
			return "UNKNOWN";
	}
}

function findApiCallError(err: unknown, depth = 0): APICallError | undefined {
	if (APICallError.isInstance(err)) return err;
	if (depth > 4 || !err || typeof err !== "object") return undefined;
	const e = err as { cause?: unknown; lastError?: unknown };
	return findApiCallError(e.lastError ?? e.cause, depth + 1);
}
