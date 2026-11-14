// apps/web/src/app/login/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginCard } from "@/components/auth/login-card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
	return (
		<main className="grid min-h-dvh place-items-center px-6 py-12">
			<Suspense fallback={null}>
				<LoginCard />
			</Suspense>
		</main>
	);
}
