// apps/web/src/lib/security-headers.ts
// Pure module for generating strict security headers and Content-Security-Policy.

export type CspDirectives = Record<string, string[]>;

export const DEFAULT_CSP_DIRECTIVES: CspDirectives = {
	"default-src": ["'self'"],
	"script-src": ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
	"style-src": ["'self'", "'unsafe-inline'"],
	"img-src": ["'self'", "data:", "blob:", "https:"],
	"font-src": ["'self'", "data:", "https:"],
	"connect-src": ["'self'", "https:", "wss:"],
	"frame-ancestors": ["'none'"],
	"object-src": ["'none'"],
	"base-uri": ["'self'"],
	"form-action": ["'self'"],
};

export function buildCspString(directives: CspDirectives): string {
	return Object.entries(directives)
		.map(([key, values]) => `${key} ${values.join(" ")}`)
		.join("; ");
}

export type SecurityHeader = {
	key: string;
	value: string;
};

export function buildSecurityHeaders(options?: {
	isDev?: boolean;
}): SecurityHeader[] {
	const isDev = options?.isDev ?? false;

	const directives: CspDirectives = {
		...DEFAULT_CSP_DIRECTIVES,
		"connect-src": [...DEFAULT_CSP_DIRECTIVES["connect-src"]],
	};

	if (isDev) {
		directives["connect-src"].push(
			"http://localhost:*",
			"ws://localhost:*",
			"http://127.0.0.1:*",
			"ws://127.0.0.1:*",
		);
	}

	const cspString = buildCspString(directives);

	return [
		{
			key: "Content-Security-Policy",
			value: cspString,
		},
		{
			key: "X-Frame-Options",
			value: "DENY",
		},
		{
			key: "X-Content-Type-Options",
			value: "nosniff",
		},
		{
			key: "Referrer-Policy",
			value: "strict-origin-when-cross-origin",
		},
		{
			key: "Permissions-Policy",
			value: "camera=(), microphone=(), geolocation=()",
		},
	];
}
