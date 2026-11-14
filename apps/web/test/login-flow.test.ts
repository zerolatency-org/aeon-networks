// apps/web/test/login-flow.test.ts
import { describe, expect, test } from "bun:test";

import { loginStep, signPurpose } from "@/lib/login-flow";

const off = { connected: false, rightChain: false };
const wrong = { connected: true, rightChain: false };
const right = { connected: true, rightChain: true };

describe("loginStep", () => {
	test("waits while the session loads and reports a server problem as unavailable", () => {
		expect(loginStep({ session: "loading", ...off })).toBe("checking");
		expect(loginStep({ session: "error", ...right })).toBe("unavailable");
	});

	test("a signed-out visitor first chooses how to sign in", () => {
		expect(loginStep({ session: "signed-out", ...off })).toBe("choose");
	});

	test("a signed-out visitor with a wallet connected switches network, then signs", () => {
		expect(loginStep({ session: "signed-out", ...wrong })).toBe("switch");
		expect(loginStep({ session: "signed-out", ...right })).toBe("sign");
	});

	test("a Google or GitHub user without a wallet connects, switches, then signs to link", () => {
		expect(loginStep({ session: "needs-wallet", ...off })).toBe("connect");
		expect(loginStep({ session: "needs-wallet", ...wrong })).toBe("switch");
		expect(loginStep({ session: "needs-wallet", ...right })).toBe("sign");
	});

	test("a ready user is done, and the signature means sign-in or link by session", () => {
		expect(loginStep({ session: "ready", ...off })).toBe("done");
		expect(signPurpose("signed-out")).toBe("sign-in");
		expect(signPurpose("needs-wallet")).toBe("link");
	});
});
