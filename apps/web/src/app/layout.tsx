// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { Navbar } from "@/components/nav/navbar";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "@/styles/globals.css";

const serif = Newsreader({
	subsets: ["latin"],
	variable: "--font-newsreader",
	display: "swap",
});
const sans = Instrument_Sans({
	subsets: ["latin"],
	variable: "--font-instrument-sans",
	display: "swap",
});
const mono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
	display: "swap",
});

export const metadata: Metadata = {
	title: { default: "Aeon", template: "%s · Aeon" },
	description: "Agents that hire agents, on 0G.",
	icons: { icon: "/logo.svg" },
	openGraph: {
		title: "Aeon",
		description: "Agents that hire agents, on 0G.",
		siteName: "Aeon",
		type: "website",
		images: [
			{
				url: "/og.png",
				width: 1200,
				height: 630,
				alt: "Aeon · Autonomous AI Agents on 0G",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Aeon",
		description: "Agents that hire agents, on 0G.",
		images: ["/og.png"],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${serif.variable} ${sans.variable} ${mono.variable}`}
		>
			<body suppressHydrationWarning>
				<ThemeProvider>
					<AppProviders>
						<Navbar />
						{children}
					</AppProviders>
				</ThemeProvider>
			</body>
		</html>
	);
}
