// apps/web/test/persona.test.ts
import { describe, expect, test } from "bun:test";

import {
	estimateTokens,
	PERSONA_LIMIT,
	PERSONA_TEMPLATES,
	templateAction,
} from "@/lib/persona";

describe("persona templates", () => {
	test("each template has a unique id and fits the persona limit", () => {
		expect(new Set(PERSONA_TEMPLATES.map((t) => t.id)).size).toBe(
			PERSONA_TEMPLATES.length,
		);
		for (const t of PERSONA_TEMPLATES) {
			expect(t.text.length).toBeGreaterThan(40);
			expect(t.text.length).toBeLessThan(PERSONA_LIMIT);
		}
	});

	test("a template replaces an empty box or another template, but asks before replacing your own text", () => {
		const [a, b] = PERSONA_TEMPLATES;
		if (!a || !b) throw new Error("need two templates");
		expect(templateAction("", a)).toBe("replace");
		expect(templateAction("   \n", a)).toBe("replace");
		expect(templateAction(b.text, a)).toBe("replace");
		expect(templateAction(a.text, a)).toBe("same");
		expect(templateAction("Speak like a ship's captain.", a)).toBe("confirm");
	});

	test("the token estimate rounds up at about four characters each", () => {
		expect(estimateTokens("")).toBe(0);
		expect(estimateTokens("abcd")).toBe(1);
		expect(estimateTokens("abcde")).toBe(2);
	});
});
