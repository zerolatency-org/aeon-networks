// apps/web/src/lib/lab.ts
// /lab is a component gallery. It is open in development and staging, and
// closed in production unless NEXT_PUBLIC_ENABLE_LAB=1 is set.

export function labEnabled(env: {
	NODE_ENV?: string | undefined;
	NEXT_PUBLIC_ENABLE_LAB?: string | undefined;
}): boolean {
	return env.NODE_ENV !== "production" || env.NEXT_PUBLIC_ENABLE_LAB === "1";
}
