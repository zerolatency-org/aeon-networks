// apps/web/src/app/page.tsx
import Link from "next/link";

import { NetworkBadge } from "@/components/wallet/network-badge";
import { WalletButton } from "@/components/wallet/wallet-button";

export default function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-[1280px] flex-col justify-center gap-6 px-6">
			<h1 className="font-serif text-[56px] leading-[60px] tracking-tight">
				Aeon
			</h1>
			<p className="text-fg-2">The landing page arrives in F2.</p>
			<div className="flex flex-wrap items-center gap-3">
				<WalletButton variant="lumen" />
				<NetworkBadge />
			</div>
			<Link className="num text-lumen-fg underline" href="/lab">
				Open the component lab
			</Link>
		</main>
	);
}
