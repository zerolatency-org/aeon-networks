// apps/web/src/components/providers/app-providers.tsx
"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";
import { WalletProviders } from "./wallet-providers";

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<QueryProvider>
			<WalletProviders>{children}</WalletProviders>
		</QueryProvider>
	);
}
