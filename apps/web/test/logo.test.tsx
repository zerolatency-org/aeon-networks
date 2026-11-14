// apps/web/test/logo.test.tsx
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import type { Logo } from "@/components/brand/logo";

describe("Logo", () => {
	test("is an image named Aeon, 28 px by default", () => {
		const { getByRole } = render(<Logo />);
		const mark = getByRole("img", { name: "Aeon" });
		expect(mark.getAttribute("width")).toBe("28");
	});

	test("is drawn in currentColor so it works in both themes, with no raw colors", () => {
		const { container } = render(<Logo />);
		expect(container.innerHTML).toContain("currentColor");
		expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
	});
});
