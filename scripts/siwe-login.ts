// P1 "done when": signs in with a throwaway wallet against a running server and reads the profile.
// Run: bun scripts/siwe-login.ts
//      BASE_URL=https://... SIWE_DOMAIN=... bun scripts/siwe-login.ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const DOMAIN = process.env.SIWE_DOMAIN ?? new URL(BASE_URL).host;
const CHAIN_ID = Number(process.env.OG_CHAIN_ID ?? 16602);
const account = privateKeyToAccount(
	(process.env.TEST_WALLET_KEY as `0x${string}`) ?? generatePrivateKey(),
);
const json = { "content-type": "application/json", origin: BASE_URL };

const nonceRes = await fetch(`${BASE_URL}/api/auth/siwe/nonce`, {
	method: "POST",
	headers: json,
	body: "{}",
});
const { nonce } = (await nonceRes.json()) as { nonce: string };

const message = createSiweMessage({
	domain: DOMAIN,
	address: account.address,
	statement: "Sign in to Aeon",
	uri: BASE_URL,
	version: "1",
	chainId: CHAIN_ID,
	nonce,
	issuedAt: new Date(),
});
const signature = await account.signMessage({ message });

const verify = await fetch(`${BASE_URL}/api/auth/siwe/verify`, {
	method: "POST",
	headers: json,
	body: JSON.stringify({ message, signature }),
});
const session = (await verify.json()) as { token?: string };
if (!verify.ok || !session.token) {
	console.error("sign-in failed", verify.status, session);
	process.exit(1);
}

const me = await fetch(`${BASE_URL}/api/me`, {
	headers: { authorization: `Bearer ${session.token}` },
});
console.log("wallet:", account.address);
console.log(
	"GET /api/me ->",
	me.status,
	JSON.stringify(await me.json(), null, 2),
);
process.exit(me.ok ? 0 : 1);
