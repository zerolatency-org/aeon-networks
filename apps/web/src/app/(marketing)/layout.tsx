import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
export default function MarketingLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<SmoothScroll />
			<MarketingNav />
			{children}
			<MarketingFooter />
		</>
	);
}
