// apps/web/src/lib/redirect.ts
export const DEFAULT_LANDING = "/agents";

/**
 * Where to go after signing in. Only a path on this site is allowed, so a
 * crafted `?next=` link cannot send someone to another site, and the login
 * page never sends people back to itself.
 */
export function safeNext(
	raw: string | null | undefined,
	fallback = DEFAULT_LANDING,
): string {
	if (!raw || !raw.startsWith("/")) return fallback;
	if (raw.startsWith("//") || raw.includes("\\")) return fallback;
	if ([...raw].some((ch) => ch.charCodeAt(0) < 32)) return fallback;
	const path = raw.split(/[?#]/)[0];
	if (path === "/login" || path?.startsWith("/login/")) return fallback;
	return raw;
}
