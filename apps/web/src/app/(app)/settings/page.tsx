// apps/web/src/app/(app)/settings/page.tsx
import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
	return (
		<main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-12">
			<h1 className="font-serif text-[56px] leading-[60px] tracking-tight">
				Settings
			</h1>
			<SettingsView />
		</main>
	);
}
