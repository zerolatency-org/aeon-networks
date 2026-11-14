// apps/web/src/lib/agents-api.ts
// The agents calls. Each one returns checked data or throws ApiError(code, status).
import {
	type AgentView,
	type AvatarChoice,
	type Confirmed,
	type PolicyInput,
	type Prepared,
	parseAgent,
	parseAgentList,
	parseConfirmed,
	parsePolicy,
	parsePrepared,
} from "./agents-parse";
import { parseAvatarSaved, toAvatarBody } from "./avatar-choice";
import { ApiError } from "./siwe-api";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: Fetch = (input, init) => globalThis.fetch(input, init);

async function request<T>(
	fetchImpl: Fetch,
	method: "GET" | "POST" | "PUT",
	path: string,
	parse: (json: unknown) => T | null,
	body?: unknown,
): Promise<T> {
	const res = await fetchImpl(path, {
		method,
		credentials: "include",
		...(body === undefined
			? {}
			: {
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body),
				}),
	});
	if (!res.ok) {
		const data = (await res.json().catch(() => null)) as {
			code?: unknown;
		} | null;
		throw new ApiError(
			typeof data?.code === "string" ? data.code : `HTTP_${res.status}`,
			res.status,
		);
	}
	const parsed = parse(await res.json().catch(() => null));
	if (parsed === null) throw new ApiError("BAD_RESPONSE", res.status);
	return parsed;
}

export const agentKeys = {
	all: ["agents"] as const,
	list: () => ["agents", "list"] as const,
	one: (id: string) => ["agents", "one", id] as const,
};

export function listAgents(
	fetchImpl: Fetch = defaultFetch,
): Promise<AgentView[]> {
	return request(fetchImpl, "GET", "/api/agents", parseAgentList);
}

export function getAgent(
	id: string,
	fetchImpl: Fetch = defaultFetch,
): Promise<AgentView> {
	return request(
		fetchImpl,
		"GET",
		`/api/agents/${encodeURIComponent(id)}`,
		parseAgent,
	);
}

export type PrepareInput = {
	name: string;
	description: string;
	model: string;
	persona: string;
};

/** Step 1 of minting: the server makes the agent wallet and returns the mint call to send. */
export function prepareAgent(
	input: PrepareInput,
	fetchImpl: Fetch = defaultFetch,
): Promise<Prepared> {
	return request(
		fetchImpl,
		"POST",
		"/api/agents/prepare",
		parsePrepared,
		input,
	);
}

/** Step 3 of minting: the server checks the mint on chain and returns the authorize call. */
export function confirmAgent(
	input: { draftId: string; txHash: string },
	fetchImpl: Fetch = defaultFetch,
): Promise<Confirmed> {
	return request(
		fetchImpl,
		"POST",
		"/api/agents/confirm",
		parseConfirmed,
		input,
	);
}

export function getPolicy(
	id: string,
	fetchImpl: Fetch = defaultFetch,
): Promise<PolicyInput> {
	return request(
		fetchImpl,
		"GET",
		`/api/agents/${encodeURIComponent(id)}/policy`,
		parsePolicy,
	);
}

export function setPolicy(
	id: string,
	policy: PolicyInput,
	fetchImpl: Fetch = defaultFetch,
): Promise<PolicyInput> {
	return request(
		fetchImpl,
		"PUT",
		`/api/agents/${encodeURIComponent(id)}/policy`,
		parsePolicy,
		policy,
	);
}

/** Saves the face the owner picked. The mint call has no avatar, so this runs right after confirm. */
export function setAvatar(
	id: string,
	choice: AvatarChoice,
	fetchImpl: Fetch = defaultFetch,
): Promise<AvatarChoice> {
	return request(
		fetchImpl,
		"PUT",
		`/api/agents/${encodeURIComponent(id)}/avatar`,
		parseAvatarSaved,
		toAvatarBody(choice),
	);
}
