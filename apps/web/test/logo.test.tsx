// apps/web/test/logo.test.tsx
import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import { Logo } from "@/components/brand/logo";

describe("Logo", () => {
	test("is an image named Aeon, 28 px by default", () => {
		const { getByRole } = render(<Logo />);
		const mark = getByRole("img", { name: "Aeon" });
		expect(mark.getAttribute("src")).toContain("/logo.svg");
		expect(mark.getAttribute("width")).toBe("431");
		expect(mark.getAttribute("height")).toBe("512");
		expect((mark as HTMLImageElement).style.height).toBe("28px");
	});

	test("renders dark mode logo variant with matching dimensions", () => {
		const { container } = render(<Logo />);
		const darkImg = container.querySelector('img[src="/logo-dark.svg"]');
		expect(darkImg).not.toBeNull();
		expect(darkImg?.getAttribute("width")).toBe("431");
		expect(darkImg?.getAttribute("height")).toBe("512");
		expect(darkImg?.className).toContain("dark:block");
	});
});
