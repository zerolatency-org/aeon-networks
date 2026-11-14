// apps/web/test/security-headers.test.ts
import { describe, expect, test } from "bun:test";
import {
	buildCspString,
	buildSecurityHeaders,
	DEFAULT_CSP_DIRECTIVES,
} from "@/lib/security-headers";

describe("Security Headers & CSP", () => {
	test("buildCspString formats directives into valid CSP header syntax", () => {
		const csp = buildCspString({
			"default-src": ["'self'"],
			"frame-ancestors": ["'none'"],
			"object-src": ["'none'"],
		});
		expect(csp).toBe(
			"default-src 'self'; frame-ancestors 'none'; object-src 'none'",
		);
	});

	test("DEFAULT_CSP_DIRECTIVES forbids frame-ancestors and object-src to prevent clickjacking", () => {
		expect(DEFAULT_CSP_DIRECTIVES["frame-ancestors"]).toEqual(["'none'"]);
		expect(DEFAULT_CSP_DIRECTIVES["object-src"]).toEqual(["'none'"]);
	});

	test("DEFAULT_CSP_DIRECTIVES permits essential connect-src for RPCs and WalletConnect relay", () => {
		const connectSrc = DEFAULT_CSP_DIRECTIVES["connect-src"];
		expect(connectSrc).toBeDefined();
		expect(connectSrc).toContain("'self'");
		expect(connectSrc).toContain("https:");
		expect(connectSrc).toContain("wss:");
	});

	test("DEFAULT_CSP_DIRECTIVES allows safe images including data and blobs for avatars", () => {
		const imgSrc = DEFAULT_CSP_DIRECTIVES["img-src"];
		expect(imgSrc).toBeDefined();
		expect(imgSrc).toContain("'self'");
		expect(imgSrc).toContain("data:");
		expect(imgSrc).toContain("blob:");
		expect(imgSrc).toContain("https:");
	});

	test("buildSecurityHeaders returns array of standard HTTP security headers", () => {
		const headers = buildSecurityHeaders();
		const headerMap = Object.fromEntries(
			headers.map((h) => [h.key.toLowerCase(), h.value]),
		);

		// X-Frame-Options
		expect(headerMap["x-frame-options"]).toBe("DENY");

		// X-Content-Type-Options
		expect(headerMap["x-content-type-options"]).toBe("nosniff");

		// Referrer-Policy
		expect(headerMap["referrer-policy"]).toMatch(
			/(strict-origin-when-cross-origin|origin-when-cross-origin)/,
		);

		// Permissions-Policy
		expect(headerMap["permissions-policy"]).toContain("camera=()");
		expect(headerMap["permissions-policy"]).toContain("microphone=()");

		// Content-Security-Policy
		expect(headerMap["content-security-policy"]).toBeDefined();
		expect(headerMap["content-security-policy"]).toContain(
			"frame-ancestors 'none'",
		);
	});

	test("buildSecurityHeaders in dev mode adds localhost connect-src", () => {
		const devHeaders = buildSecurityHeaders({ isDev: true });
		const csp = devHeaders.find(
			(h) => h.key.toLowerCase() === "content-security-policy",
		)?.value;
		expect(csp).toBeDefined();
		expect(csp).toContain("ws://localhost:*");
	});
});
