// apps/web/src/components/settings/linked-accounts.tsx
"use client";

import { GithubLogo, GoogleLogo } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ProblemNotice } from "@/components/auth/problem-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { providerRows, type SocialId, unlinkMessage } from "@/lib/accounts";
import { linkProvider, listAccounts, unlinkProvider } from "@/lib/auth-client";

const ACCOUNTS_KEY = ["auth", "accounts"] as const;
const ICONS = { google: GoogleLogo, github: GithubLogo } as const;

export function LinkedAccounts({ walletCount }: { walletCount: number }) {
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState<{ title: string; hint: string } | null>(
		null,
	);

	const accounts = useQuery({
		queryKey: ACCOUNTS_KEY,
		queryFn: async () => {
			const res = await listAccounts();
			if (res.error) throw res.error;
			return res.data ?? [];
		},
	});

	const unlink = useMutation({
		mutationFn: async (provider: SocialId) => {
			const res = await unlinkProvider(provider);
			if (res.error) throw res.error;
		},
		onMutate: () => setNotice(null),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
		onError: (e) => setNotice(unlinkMessage(e)),
	});

	async function connect(provider: SocialId) {
		setNotice(null);
		const res = await linkProvider(provider, "/settings");
		if (res?.error) {
			setNotice({
				title: "Could not connect it",
				hint: "Try again. If it keeps happening, the provider may not be set up on the server yet.",
			});
		}
	}

	if (accounts.isPending) return <Skeleton className="h-24 w-full" />;
	if (accounts.isError) {
		return (
			<ProblemNotice
				title="Could not load your accounts"
				hint="Reload the page. If it keeps happening, the server may be down."
			/>
		);
	}

	const rows = providerRows({ accounts: accounts.data, walletCount });

	return (
		<div className="flex flex-col gap-3">
			<ul className="divide-border flex flex-col divide-y">
				{rows.map((row) => {
					const Icon = ICONS[row.id];
					return (
						<li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
							<Icon aria-hidden size={20} className="text-fg-2" />
							<span className="font-medium">{row.label}</span>
							<Badge tone={row.linked ? "done" : "neutral"}>
								{row.linked ? "Linked" : "Not linked"}
							</Badge>
							<div className="ml-auto flex items-center gap-3">
								{row.linked && !row.canUnlink ? (
									<span className="text-fg-2 text-[13px]">
										Your only way to sign in
									</span>
								) : null}
								{row.linked && row.canUnlink ? (
									<Button
										size="sm"
										variant="outline"
										disabled={unlink.isPending}
										onClick={() => unlink.mutate(row.id)}
									>
										Disconnect
									</Button>
								) : null}
								{!row.linked ? (
									<Button
										size="sm"
										variant="outline"
										onClick={() => connect(row.id)}
									>
										Connect
									</Button>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
			{notice ? (
				<ProblemNotice title={notice.title} hint={notice.hint} />
			) : null}
		</div>
	);
}
