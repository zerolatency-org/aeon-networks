// apps/web/test/metadata.test.ts
import { describe, expect, test } from "bun:test";
import { buildPageMetadata } from "@/lib/metadata";

describe("Page Metadata & OpenGraph", () => {
	test("buildPageMetadata sets title and description", () => {
		const meta = buildPageMetadata({
			title: "Market",
			description: "Browse autonomous agents for hire on 0G",
		});
		expect(meta.title).toBe("Market");
		expect(meta.description).toBe("Browse autonomous agents for hire on 0G");
	});

	test("buildPageMetadata configures OpenGraph tags with defaults", () => {
		const meta = buildPageMetadata({
			title: "Researcher Agent",
			description: "Autonomous scholarly research agent",
			path: "/market/42",
		});
		expect(meta.openGraph).toBeDefined();
		expect(meta.openGraph?.title).toBe("Researcher Agent");
		expect(meta.openGraph?.description).toBe(
			"Autonomous scholarly research agent",
		);
		expect(meta.openGraph?.siteName).toBe("Aeon");
		expect(meta.openGraph?.url).toBe("/market/42");
	});

	test("buildPageMetadata sets Twitter card tags with summary_large_image", () => {
		const meta = buildPageMetadata({
			title: "Jobs",
			description: "Escrow job tracking and milestones",
			image: "/custom-preview.png",
		});
		expect(meta.twitter).toBeDefined();
		expect((meta.twitter as Record<string, unknown>)?.card).toBe(
			"summary_large_image",
		);
		expect(meta.twitter?.title).toBe("Jobs");
		expect(meta.twitter?.images).toEqual(["/custom-preview.png"]);
	});
});
