// apps/web/test/avatar-choice.test.ts
import { describe, expect, test } from "bun:test";

import { PRESET_IDS } from "@/content/avatars";
import {
	cleanSeed,
	fromServerAvatar,
	isPresetId,
	parseAvatarSaved,
	presetSrc,
	sameAvatar,
	shuffleFace,
	suggestAvatar,
	toAvatarBody,
} from "@/lib/avatar-choice";

describe("preset faces", () => {
	test("there are 20, named p01 to p20 in order", () => {
		expect(PRESET_IDS).toHaveLength(20);
		expect(PRESET_IDS[0]).toBe("p01");
		expect(PRESET_IDS[19]).toBe("p20");
		expect(new Set(PRESET_IDS).size).toBe(20);
	});

	test("only real ids are presets, and each has a file path", () => {
		expect(isPresetId("p07")).toBe(true);
		for (const bad of ["p21", "p1", "P01", "", "p00", null, 7])
			expect(isPresetId(bad)).toBe(false);
		expect(presetSrc("p05")).toBe("/avatars/p05.webp");
	});
});

describe("seeds and suggestions", () => {
	test("a seed is trimmed, lower case and at most 40 characters; empty is null", () => {
		expect(cleanSeed("  Scout Bot ")).toBe("scout bot");
		expect(cleanSeed("x".repeat(80))).toHaveLength(40);
		expect(cleanSeed("   ")).toBeNull();
	});

	test("a name gives the same suggested face every time, and no name gives none", () => {
		const a = suggestAvatar("Scout");
		expect(a).toEqual(suggestAvatar("  scout "));
		expect(a?.kind).toBe("dicebear");
		expect(suggestAvatar("  ")).toBeNull();
	});

	test("shuffling uses the random source and always gives a valid generated face", () => {
		expect(shuffleFace(() => 0)).toEqual({
			kind: "dicebear",
			seed: "aaaaaaaa",
			bg: "tide",
		});
		const face = shuffleFace();
		if (face.kind !== "dicebear") throw new Error("expected a generated face");
		expect(
			fromServerAvatar("dicebear", { seed: face.seed, bg: face.bg }),
		).toEqual(face);
	});
});

describe("what the server stores", () => {
	test("a choice becomes the body of the avatar save", () => {
		expect(toAvatarBody({ kind: "preset", id: "p03" })).toEqual({
			avatar: { kind: "preset", ref: "p03" },
		});
		expect(toAvatarBody({ kind: "dicebear", seed: "ada", bg: "moss" })).toEqual(
			{
				avatar: { kind: "dicebear", ref: { seed: "ada", bg: "moss" } },
			},
		);
	});

	test("what the server returns is read back, and anything unknown is null", () => {
		expect(fromServerAvatar("preset", "p01")).toEqual({
			kind: "preset",
			id: "p01",
		});
		expect(fromServerAvatar("dicebear", { seed: "ada", bg: "moss" })).toEqual({
			kind: "dicebear",
			seed: "ada",
			bg: "moss",
		});
		expect(fromServerAvatar("preset", "p99")).toBeNull();
		expect(
			fromServerAvatar("dicebear", { seed: "ada", bg: "pink" }),
		).toBeNull();
		expect(
			fromServerAvatar("dicebear", { seed: "Ada", bg: "moss" }),
		).toBeNull();
		expect(fromServerAvatar("upload", "m1")).toBeNull();
		expect(
			parseAvatarSaved({ avatarKind: "preset", avatarRef: "p02" }),
		).toEqual({ kind: "preset", id: "p02" });
		expect(parseAvatarSaved(null)).toBeNull();
	});

	test("two choices are the same only when kind and value match", () => {
		expect(
			sameAvatar({ kind: "preset", id: "p01" }, { kind: "preset", id: "p01" }),
		).toBe(true);
		expect(
			sameAvatar({ kind: "preset", id: "p01" }, { kind: "preset", id: "p02" }),
		).toBe(false);
		expect(
			sameAvatar(
				{ kind: "dicebear", seed: "a", bg: "tide" },
				{ kind: "preset", id: "p01" },
			),
		).toBe(false);
		expect(sameAvatar(null, null)).toBe(true);
		expect(sameAvatar(null, { kind: "preset", id: "p01" })).toBe(false);
	});
});
