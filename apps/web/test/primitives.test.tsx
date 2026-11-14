// apps/web/test/primitives.test.tsx
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Glass } from "@/components/ui/glass";
import { Skeleton } from "@/components/ui/skeleton";

describe("Button", () => {
	test("the lumen variant carries the accent fill and ink text", () => {
		const { getByRole } = render(<Button variant="lumen">Launch app</Button>);
		const el = getByRole("button", { name: "Launch app" });
		expect(el.className).toContain("bg-lumen");
		expect(el.className).toContain("text-lumen-ink");
	});

	test("no other variant uses the accent fill", () => {
		for (const variant of ["default", "outline", "ghost", "danger"] as const) {
			const { getByRole, unmount } = render(
				<Button variant={variant}>x</Button>,
			);
			expect(getByRole("button").className, variant).not.toContain("bg-lumen");
			unmount();
		}
	});

	test("defaults to type=button so it never submits a form by accident", () => {
		const { getByRole } = render(<Button>Save</Button>);
		expect(getByRole("button").getAttribute("type")).toBe("button");
	});

	test("asChild puts the button styles on the child element", () => {
		const { getByRole } = render(
			<Button asChild variant="lumen">
				<a href="/lab">Open lab</a>
			</Button>,
		);
		const link = getByRole("link", { name: "Open lab" });
		expect(link.getAttribute("href")).toBe("/lab");
		expect(link.className).toContain("bg-lumen");
	});
});

describe("Badge", () => {
	test("shows its word and takes its color from the meaning", () => {
		const { getByText } = render(<Badge tone="done">Paid</Badge>);
		expect(getByText("Paid").className).toContain("text-moss");
	});

	test("only the live tone uses the accent fill", () => {
		const live = render(<Badge tone="live">Live</Badge>);
		expect(live.getByText("Live").className).toContain("bg-lumen");
		live.unmount();
		const waiting = render(<Badge tone="waiting">Waiting</Badge>);
		expect(waiting.getByText("Waiting").className).not.toContain("bg-lumen");
	});
});

describe("Card", () => {
	test("is a solid bordered surface, never glass, and its title is a serif heading", () => {
		const { getByRole, container } = render(
			<Card>
				<CardTitle>Agents</CardTitle>
			</Card>,
		);
		const card = container.firstElementChild as HTMLElement;
		expect(card.className).toContain("bg-surface-1");
		expect(card.className).toContain("border");
		expect(card.className).not.toContain("glass");
		expect(getByRole("heading", { name: "Agents" }).className).toContain(
			"font-serif",
		);
	});
});

describe("Skeleton", () => {
	test("pulses between flat surfaces and is hidden from assistive tech", () => {
		const { container } = render(<Skeleton className="h-4 w-32" />);
		const el = container.firstElementChild as HTMLElement;
		expect(el.className).toContain("animate-surface-pulse");
		expect(el.className).not.toContain("gradient");
		expect(el.getAttribute("aria-hidden")).toBe("true");
	});
});

describe("Glass", () => {
	test("carries the glass layer class", () => {
		const { container } = render(<Glass>floating</Glass>);
		expect((container.firstElementChild as HTMLElement).className).toContain(
			"glass",
		);
	});
});
