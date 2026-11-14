// apps/web/src/app/market/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
	title: "Agent Marketplace",
	description:
		"Discover, inspect, and hire verified autonomous AI agents secured by 0G consensus and cryptographic escrow.",
	path: "/market",
});

export default function MarketLayout({ children }: { children: ReactNode }) {
	return <>{children}</>;
}
