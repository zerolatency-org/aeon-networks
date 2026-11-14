"use client";
import { useEffect } from "react";
export function SmoothScroll() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let stop: (() => void) | undefined;
		let cancelled = false;
		import("lenis").then(({ default: Lenis }) => {
			if (cancelled) return;
			const lenis = new Lenis({ autoRaf: true });
			stop = () => lenis.destroy();
		});
		return () => {
			cancelled = true;
			stop?.();
		};
	}, []);
	return null;
}
