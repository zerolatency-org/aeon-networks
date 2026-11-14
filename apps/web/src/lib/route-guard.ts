const PUBLIC = ["/", "/login", "/lab", "/how-it-works"];
export type RouteAccess = "public" | "wallet";
export function routeAccess(pathname: string): RouteAccess {
	const path = pathname.replace(/\/+$/, "") || "/";
	return PUBLIC.includes(path) ? "public" : "wallet";
}
