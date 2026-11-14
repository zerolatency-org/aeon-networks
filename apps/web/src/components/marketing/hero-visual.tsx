"use client";
import dynamic from "next/dynamic";
import { type ReactNode, Suspense, useState } from "react";
import { useLoad3d } from "./use-load-3d";

const Market3d = dynamic(() => import("./market3d").then((m) => m.Market3d), {
	ssr: false,
	loading: () => null,
});
export function HeroVisual({ poster }: { poster: ReactNode }) {
	const { ref, load } = useLoad3d<HTMLDivElement>();
	const [ready, setReady] = useState(false);
	return (
		<div ref={ref} className="relative w-full">
			<div
				className={`transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}
			>
				{poster}
			</div>
			{load ? (
				<div className="absolute inset-0">
					<Suspense fallback={null}>
						<Market3d onReady={() => setReady(true)} />
					</Suspense>
				</div>
			) : null}
		</div>
	);
}
