// apps/web/src/app/lab/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LabClient } from "@/components/lab/lab-client";
import { labEnabled } from "@/lib/lab";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
	if (
		!labEnabled({
			NODE_ENV: process.env.NODE_ENV,
			NEXT_PUBLIC_ENABLE_LAB: process.env.NEXT_PUBLIC_ENABLE_LAB,
		})
	) {
		notFound();
	}
	return <LabClient />;
}
