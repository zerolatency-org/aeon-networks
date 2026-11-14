// packages/harness/src/mock-router.ts
// Test helper (imported only by tests, here and in apps/server).
// A Bun.serve stand-in for the 0G Router: OpenAI-shaped JSON and SSE, an x_0g_trace on
// every response, scripted replies, and HTTP errors on demand.

export type Reply =
	| {
			text: string[];
			trace?: string;
			usage?: [number, number];
			delayMs?: number;
	  }
	| {
			tool: string;
			args: Record<string, unknown>;
			trace?: string;
			usage?: [number, number];
	  }
	| { status: number; code: string };

export type MockRouter = Awaited<ReturnType<typeof startMockRouter>>;

export function startMockRouter() {
	const queue: Reply[] = [];
	const requests: { body: Record<string, unknown>; aborted: () => boolean }[] =
		[];
	let seq = 0;

	const server = Bun.serve({
		port: 0,
		idleTimeout: 30,
		async fetch(req) {
			if (!new URL(req.url).pathname.endsWith("/chat/completions")) {
				return new Response("not found", { status: 404 });
			}
			const body = (await req.json()) as Record<string, unknown>;
			requests.push({ body, aborted: () => req.signal.aborted });
			const reply = queue.shift() ?? { text: ["(no script)"] };
			const id = `chatcmpl-${++seq}`;

			if ("status" in reply) {
				return Response.json(
					{
						error: { message: reply.code, type: "error", code: reply.code },
						request_id: id,
					},
					{ status: reply.status },
				);
			}
			const [prompt, completion] = reply.usage ?? [10, 5];
			const usage = {
				prompt_tokens: prompt,
				completion_tokens: completion,
				total_tokens: prompt + completion,
			};
			const trace = reply.trace
				? {
						request_id: id,
						provider: "0xprovider",
						billing: { total_cost: reply.trace },
					}
				: undefined;
			const toolCall =
				"tool" in reply
					? {
							id: `call_${seq}`,
							type: "function",
							function: {
								name: reply.tool,
								arguments: JSON.stringify(reply.args),
							},
						}
					: undefined;

			if (!body.stream) {
				return Response.json({
					id,
					object: "chat.completion",
					created: 0,
					model: body.model,
					choices: [
						{
							index: 0,
							message: toolCall
								? { role: "assistant", content: null, tool_calls: [toolCall] }
								: {
										role: "assistant",
										content: (reply as { text: string[] }).text.join(""),
									},
							finish_reason: toolCall ? "tool_calls" : "stop",
						},
					],
					usage,
					...(trace ? { x_0g_trace: trace } : {}),
				});
			}

			const chunk = (delta: object, finish: string | null = null) =>
				`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: body.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
			const delayMs = "text" in reply ? (reply.delayMs ?? 0) : 0;
			const stream = new ReadableStream({
				async start(controller) {
					const send = (s: string) =>
						controller.enqueue(new TextEncoder().encode(s));
					try {
						if (toolCall) {
							send(
								chunk({
									role: "assistant",
									tool_calls: [{ index: 0, ...toolCall }],
								}),
							);
							send(chunk({}, "tool_calls"));
						} else {
							for (const part of (reply as { text: string[] }).text) {
								if (req.signal.aborted) return controller.close();
								send(chunk({ role: "assistant", content: part }));
								if (delayMs) await Bun.sleep(delayMs);
							}
							send(chunk({}, "stop"));
						}
						send(
							`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: body.model, choices: [], usage, ...(trace ? { x_0g_trace: trace } : {}) })}\n\n`,
						);
						send("data: [DONE]\n\n");
						controller.close();
					} catch {
						// client went away
					}
				},
			});
			return new Response(stream, {
				headers: { "content-type": "text/event-stream" },
			});
		},
	});

	return {
		url: `http://127.0.0.1:${server.port}/v1`,
		script: (...replies: Reply[]) => queue.push(...replies),
		requests,
		reset: () => {
			queue.length = 0;
			requests.length = 0;
		},
		stop: () => server.stop(true),
	};
}
