"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import {
	DEMO_LOOP_MS,
	DEMO_SCRIPT,
	DEMO_STILL_MS,
	stateAt,
	type VaultState,
} from "@/lib/vault";
export function useVaultDemo(active: boolean): VaultState {
	const reduced = useReducedMotion();
	const [state, setState] = useState(() => stateAt(DEMO_SCRIPT, DEMO_STILL_MS));
	useEffect(() => {
		if (reduced || !active) return;
		const start = performance.now();
		const id = window.setInterval(
			() =>
				setState(
					stateAt(DEMO_SCRIPT, (performance.now() - start) % DEMO_LOOP_MS),
				),
			100,
		);
		return () => clearInterval(id);
	}, [active, reduced]);
	return state;
}
