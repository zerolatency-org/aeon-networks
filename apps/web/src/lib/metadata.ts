// apps/web/src/lib/metadata.ts
// Pure module for generating consistent OpenGraph and SEO metadata.
import type { Metadata } from "next";

export type PageMetadataOptions = {
	title: string;
	description: string;
	path?: string;
	image?: string;
};

export function buildPageMetadata(options: PageMetadataOptions): Metadata {
	const { title, description, path, image = "/og.png" } = options;

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			url: path,
			siteName: "Aeon",
			type: "website",
			images: [
				{
					url: image,
					width: 1200,
					height: 630,
					alt: title,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [image],
		},
	};
}
