// apps/web/src/components/feedback/use-delayed-visible.ts
"use client";

import { useEffect, useState } from "react";

/** False until `delay` ms have passed. A delay of 0 or less is visible at once. */
export function useDelayedVisible(delay: number): boolean {
	const [visible, setVisible] = useState(delay <= 0);

	useEffect(() => {
		if (delay <= 0) return;
		const id = setTimeout(() => setVisible(true), delay);
		return () => clearTimeout(id);
	}, [delay]);

	return visible;
}
