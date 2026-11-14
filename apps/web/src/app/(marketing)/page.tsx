import { Suspense } from "react";
import { AgentsSection } from "@/components/marketing/agents-section";
import { BuiltOn0g } from "@/components/marketing/built-on-0g";
import { Hero } from "@/components/marketing/hero";
import { JobScene } from "@/components/marketing/job-scene";
import { StatsSkeleton, StatsStrip } from "@/components/marketing/stats-strip";
import { VaultSection } from "@/components/marketing/vault-section";
export const revalidate = 60;
export default function LandingPage() {
	return (
		<main>
			<Hero />
			<section
				className="mx-auto max-w-[1280px] px-6 pb-16"
				aria-label="Aeon in numbers"
			>
				<Suspense fallback={<StatsSkeleton />}>
					<StatsStrip />
				</Suspense>
			</section>
			<JobScene />
			<VaultSection />
			<AgentsSection />
			<BuiltOn0g />
		</main>
	);
}
