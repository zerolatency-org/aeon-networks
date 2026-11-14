// apps/web/test/spinners.test.tsx
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import { Ink, Orbit, Relay, Seal } from "@/components/feedback/spinners";

const all = [
	{ name: "Orbit", Spinner: Orbit, label: "Agent is working" },
	{ name: "Seal", Spinner: Seal, label: "Encrypting" },
	{ name: "Relay", Spinner: Relay, label: "Syncing with 0G Storage" },
	{ name: "Ink", Spinner: Ink, label: "Loading" },
] as const;

describe("spinners", () => {
	for (const { name, Spinner, label } of all) {
		test(`${name} announces itself with a status role and a label`, () => {
			const { getByRole } = render(<Spinner delay={0} />);
			expect(getByRole("status", { name: label })).toBeTruthy();
		});
	}

	test("stays hidden for the first 300 ms so fast responses never flash one", () => {
		const { container } = render(<Orbit />);
		expect(container.querySelector("svg")).toBeNull();
	});

	test("appears once the delay has passed", async () => {
		const { findByRole } = render(<Relay delay={20} />);
		expect(await findByRole("status")).toBeTruthy();
	});

	test("accepts a custom label", () => {
		const { getByRole } = render(<Seal delay={0} label="Decrypting result" />);
		expect(getByRole("status", { name: "Decrypting result" })).toBeTruthy();
	});
});
