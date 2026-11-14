// apps/web/e2e/support.ts
import type { Page, Route } from "@playwright/test";

import { E2E_RPC_URL } from "./env";

export const TEST_ADDRESS = "0x3eb2c1f5d8a94e6b7c0d1e2f3a4b5c6d7e8fa2ab";
const GALILEO_HEX = "0x40da";
const BALANCE_HEX = "0x13b4da79fd0e0000"; // 1.42 0G

export type MockUser = {
	id: string;
	name: string | null;
	email: string | null;
	image: string | null;
};
export type MockWallet = {
	address: string;
	chainId: number;
	isPrimary: boolean;
};
export type ApiFailure = { code: string; status: number };

export type MockState = {
	user: MockUser | null;
	wallets: MockWallet[];
	accounts: { providerId: string }[];
	verifyError: ApiFailure | null;
	linkError: ApiFailure | null;
	calls: { nonce: number; verify: number; link: number };
};

export const githubUser: MockUser = {
	id: "u-github",
	name: "Ada",
	email: "ada@example.com",
	image: null,
};
export const walletUser: MockUser = {
	id: "u-wallet",
	name: null,
	email: null,
	image: null,
};
export const ownedWallet: MockWallet = {
	address: TEST_ADDRESS,
	chainId: 16602,
	isPrimary: true,
};

const json = (route: Route, status: number, body: unknown) =>
	route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	});

// oRPC's RPC protocol wraps every payload in { json, meta }. Checked against the real server in 11.0.
const rpcOk = (data: unknown) => ({ json: data, meta: [] });
const rpcError = (code: string, status: number) => ({
	json: { defined: false, code, status, message: code },
	meta: [],
});

/** Nothing leaves the machine. WalletConnect's relay and API are refused, so tests never wait on them. */
export async function isolate(page: Page): Promise<void> {
	await page.route(
		(url) => !["localhost", "127.0.0.1"].includes(url.hostname),
		(route) => route.abort(),
	);
	await page.routeWebSocket(/walletconnect|reown/, (ws) => ws.close());
}

type RpcRequest = { id: number | string; method: string };

function rpcResult(method: string): unknown {
	if (method === "eth_chainId") return GALILEO_HEX;
	if (method === "eth_getBalance") return BALANCE_HEX;
	if (method === "eth_blockNumber") return "0x10";
	return null;
}

/**
 * Answers the app's API calls from a small state object. The returned object is live:
 * change `state.linkError` or read `state.calls` from the test.
 */
export async function mockApi(
	page: Page,
	initial: Partial<MockState> = {},
): Promise<MockState> {
	const state: MockState = {
		user: null,
		wallets: [],
		accounts: [],
		verifyError: null,
		linkError: null,
		calls: { nonce: 0, verify: 0, link: 0 },
		...initial,
	};

	// Routes registered later win, so the block-everything rule goes first.
	await isolate(page);

	await page.route("**/rpc/**", (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path === "/rpc/me") {
			if (!state.user) return json(route, 401, rpcError("UNAUTHORIZED", 401));
			return json(
				route,
				200,
				rpcOk({ user: state.user, wallets: state.wallets }),
			);
		}
		if (path === "/rpc/agents/list") {
			if (!state.user) return json(route, 401, rpcError("UNAUTHORIZED", 401));
			if (state.wallets.length === 0)
				return json(route, 403, rpcError("WALLET_REQUIRED", 403));
			return json(route, 200, rpcOk({ agents: [] }));
		}
		return json(route, 404, rpcError("NOT_FOUND", 404));
	});

	await page.route("**/api/auth/siwe/nonce", (route) => {
		state.calls.nonce++;
		return json(route, 200, { nonce: "e2eNonce12345678" });
	});

	await page.route("**/api/auth/siwe/verify", (route) => {
		state.calls.verify++;
		if (state.verifyError) {
			return json(route, state.verifyError.status, {
				code: state.verifyError.code,
			});
		}
		state.user = walletUser;
		state.wallets = [ownedWallet];
		return json(route, 200, {
			token: "test-token",
			user: { id: walletUser.id },
		});
	});

	await page.route("**/api/wallet/link", (route) => {
		state.calls.link++;
		if (!state.user) return json(route, 401, { code: "UNAUTHORIZED" });
		if (state.linkError)
			return json(route, state.linkError.status, {
				code: state.linkError.code,
			});
		state.wallets = [
			...state.wallets,
			{ ...ownedWallet, isPrimary: state.wallets.length === 0 },
		];
		return json(route, 200, {
			address: TEST_ADDRESS,
			chainId: 16602,
			alreadyLinked: false,
		});
	});

	await page.route("**/api/auth/sign-out", (route) => {
		state.user = null;
		state.wallets = [];
		return json(route, 200, { success: true });
	});

	await page.route("**/api/auth/list-accounts", (route) =>
		json(
			route,
			200,
			state.accounts.map((a) => ({
				id: `account-${a.providerId}`,
				providerId: a.providerId,
				accountId: a.providerId,
				scopes: [],
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			})),
		),
	);

	// The Galileo RPC the balance pill reads. It is a different origin, so it needs CORS headers.
	const rpcHost = new URL(E2E_RPC_URL).hostname;
	await page.route(
		(url) => url.hostname === rpcHost,
		async (route) => {
			const cors = {
				"access-control-allow-origin": "*",
				"access-control-allow-headers": "*",
				"access-control-allow-methods": "POST, OPTIONS",
			};
			if (route.request().method() === "OPTIONS") {
				return route.fulfill({ status: 204, headers: cors });
			}
			const body = route.request().postDataJSON() as RpcRequest | RpcRequest[];
			const answer = (r: RpcRequest) => ({
				jsonrpc: "2.0",
				id: r.id,
				result: rpcResult(r.method),
			});
			return route.fulfill({
				status: 200,
				headers: cors,
				contentType: "application/json",
				body: JSON.stringify(
					Array.isArray(body) ? body.map(answer) : answer(body),
				),
			});
		},
	);

	return state;
}

/**
 * Installs a fake MetaMask before the app loads. It announces itself the modern way (EIP-6963) and the
 * old way (window.ethereum), answers the few calls wagmi makes, and signs with a dummy value.
 */
export async function injectWallet(
	page: Page,
	opts: { chainId?: number } = {},
): Promise<void> {
	await page.addInitScript(
		({ address, chainId }) => {
			type Listener = (...args: unknown[]) => void;
			const listeners = new Map<string, Listener[]>();
			const state = { chainId, authorized: false, rejectNext: false };
			const hex = (n: number) => `0x${n.toString(16)}`;
			const emit = (event: string, ...args: unknown[]) => {
				for (const fn of listeners.get(event) ?? []) fn(...args);
			};

			const provider = {
				isMetaMask: true,
				async request({
					method,
					params,
				}: {
					method: string;
					params?: unknown[];
				}) {
					switch (method) {
						case "eth_requestAccounts":
							state.authorized = true;
							return [address];
						case "eth_accounts":
							return state.authorized ? [address] : [];
						case "eth_chainId":
							return hex(state.chainId);
						case "net_version":
							return String(state.chainId);
						case "wallet_switchEthereumChain":
						case "wallet_addEthereumChain": {
							const p0 = params?.[0] as { chainId?: string } | undefined;
							const next = Number.parseInt(p0?.chainId ?? "0x0", 16);
							state.chainId = next;
							emit("chainChanged", hex(next));
							return null;
						}
						case "personal_sign":
							if (state.rejectNext) {
								state.rejectNext = false;
								throw Object.assign(new Error("User rejected the request."), {
									code: 4001,
								});
							}
							return `0x${"11".repeat(65)}`;
						default:
							return null;
					}
				},
				on(event: string, fn: Listener) {
					listeners.set(event, [...(listeners.get(event) ?? []), fn]);
					return provider;
				},
				removeListener(event: string, fn: Listener) {
					listeners.set(
						event,
						(listeners.get(event) ?? []).filter((f) => f !== fn),
					);
					return provider;
				},
			};

			Object.defineProperty(window, "ethereum", {
				value: provider,
				configurable: true,
			});

			const info = {
				uuid: "aeon-e2e-wallet",
				name: "MetaMask",
				icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
				rdns: "io.metamask",
			};
			const announce = () =>
				window.dispatchEvent(
					new CustomEvent("eip6963:announceProvider", {
						detail: Object.freeze({ info, provider }),
					}),
				);
			window.addEventListener("eip6963:requestProvider", announce);
			announce();

			Object.assign(window, {
				__aeonWallet: {
					rejectNextSignature: () => {
						state.rejectNext = true;
					},
				},
			});
		},
		{ address: TEST_ADDRESS, chainId: opts.chainId ?? 16602 },
	);
}

/** The next signature request fails the way MetaMask does when you press Reject. */
export function rejectNextSignature(page: Page): Promise<void> {
	return page.evaluate(() => {
		(
			window as unknown as { __aeonWallet: { rejectNextSignature(): void } }
		).__aeonWallet.rejectNextSignature();
	});
}
