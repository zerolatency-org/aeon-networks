// apps/web/src/components/nav/use-run-command.ts
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useDisconnect } from "wagmi";

import { useThemeToggle } from "@/components/theme/use-theme-toggle";
import { signOut } from "@/lib/auth-client";
import type { CommandItem } from "@/lib/nav";

export function useRunCommand(): (item: CommandItem) => Promise<void> {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { disconnect } = useDisconnect();
	const toggleTheme = useThemeToggle();

	return useCallback(
		async (item) => {
			switch (item.run.type) {
				case "navigate":
					router.push(item.run.href);
					return;
				case "theme":
					toggleTheme();
					return;
				case "signOut":
					await signOut();
					disconnect();
					queryClient.clear();
					router.replace("/login");
					return;
			}
		},
		[router, queryClient, disconnect, toggleTheme],
	);
}
