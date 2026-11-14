import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
export default function MarketingLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<SmoothScroll />
			{children}
			<MarketingFooter />
		</>
	);
}
