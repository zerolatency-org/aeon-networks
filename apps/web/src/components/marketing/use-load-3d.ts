"use client";
import { useEffect, useRef, useState } from "react";
import { isSlowNetwork, shouldLoad3d } from "@/lib/load-3d";
export function useLoad3d<T extends Element>() {
	const ref = useRef<T>(null);
	const [load, setLoad] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const c = (
			navigator as Navigator & {
				connection?: { saveData?: boolean; effectiveType?: string };
			}
		).connection;
		const facts = {
			webgl: Boolean(document.createElement("canvas").getContext("webgl")),
			reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
			saveData: !!c?.saveData,
			slowNetwork: isSlowNetwork(c?.effectiveType),
		};
		const now = { visible: false, idle: false };
		const observer = new IntersectionObserver(
			([e]) => {
				now.visible = !!e?.isIntersecting;
				if (shouldLoad3d({ ...facts, ...now })) {
					setLoad(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);
		observer.observe(el);
		const timer = window.setTimeout(() => {
			now.idle = true;
			if (now.visible && shouldLoad3d({ ...facts, ...now })) {
				setLoad(true);
				observer.disconnect();
			}
		}, 200);
		return () => {
			clearTimeout(timer);
			observer.disconnect();
		};
	}, []);
	return { ref, load };
}
