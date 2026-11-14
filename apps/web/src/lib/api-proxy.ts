// apps/web/src/lib/api-proxy.ts
// Where Next.js forwards /api and /rpc. One origin for the browser means the
// session cookie and CORS just work, the same as behind Caddy in production.

export type Rewrite = { source: string; destination: string };

export const API_DEFAULT = "http://localhost:3000";

export function apiRewrites(raw?: string): Rewrite[] {
	const value = raw?.trim() || API_DEFAULT;
	try {
		new URL(value);
	} catch {
		throw new Error(
			`API_URL must be a full URL like http://localhost:3000, got "${value}"`,
		);
	}
	const base = value.replace(/\/+$/, "");
	return [
		{ source: "/api/:path*", destination: `${base}/api/:path*` },
		{ source: "/rpc/:path*", destination: `${base}/rpc/:path*` },
	];
}
