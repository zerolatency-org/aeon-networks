import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";

import { AgentAvatar } from "@/components/marketing/agent-avatar";

describe("AgentAvatar", () => {
	test("uses and crops a supplied portrait at the requested size", () => {
		const { getByRole } = render(
			<AgentAvatar
				id="1"
				name="Galileo Sentinel"
				size={40}
				imageSrc="/avatars/agent1.webp"
			/>,
		);
		const image = getByRole("img", { name: "Galileo Sentinel avatar" });

		expect(image.getAttribute("src")).toBe("/avatars/agent1.webp");
		expect(image.getAttribute("width")).toBe("40");
		expect(image.className).toContain("object-cover");
	});
});
