// apps/web/src/lib/siwe-api.ts
export class ApiError extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
	) {
		super(code);
		this.name = "ApiError";
	}
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: Fetch = (input, init) => globalThis.fetch(input, init);

async function post(
	fetchImpl: Fetch,
	path: string,
	body: unknown,
): Promise<Response> {
	const res = await fetchImpl(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	if (res.ok) return res;
	const data = (await res.json().catch(() => null)) as {
		code?: unknown;
	} | null;
	throw new ApiError(
		typeof data?.code === "string" ? data.code : `HTTP_${res.status}`,
		res.status,
	);
}

export async function fetchNonce(
	fetchImpl: Fetch = defaultFetch,
): Promise<string> {
	const res = await post(fetchImpl, "/api/auth/siwe/nonce", {});
	return ((await res.json()) as { nonce: string }).nonce;
}

/** Signs in with a wallet. The session cookie is set by the response. */
export async function verifySiwe(
	input: { message: string; signature: string },
	fetchImpl: Fetch = defaultFetch,
): Promise<{ userId: string | undefined }> {
	const res = await post(fetchImpl, "/api/auth/siwe/verify", input);
	const body = (await res.json().catch(() => ({}))) as {
		user?: { id?: string };
	};
	return { userId: body.user?.id };
}

export type LinkResult = {
	address: string;
	chainId: number;
	alreadyLinked: boolean;
};

/** Links a wallet to the account that is signed in with Google or GitHub. */
export async function linkWallet(
	input: { message: string; signature: string },
	fetchImpl: Fetch = defaultFetch,
): Promise<LinkResult> {
	const res = await post(fetchImpl, "/api/wallet/link", input);
	return (await res.json()) as LinkResult;
}
