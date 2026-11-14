// apps/web/src/lib/avatar-choice.ts
// The face an owner picks, and how it maps to what the server stores
// (agents.avatar_kind + agents.avatar_ref). Pure: no React, no fetching.
import { PRESET_EXT, PRESET_IDS } from "@/content/avatars";

import type { AvatarChoice } from "./agents-parse";
import {
	AVATAR_TINTS,
	type AvatarTint,
	avatarSeed,
	avatarTint,
} from "./avatar";

export const SEED_MAX = 40;

export const isPresetId = (id: unknown): id is string =>
	typeof id === "string" && PRESET_IDS.includes(id);

export const presetSrc = (id: string) => `/avatars/${id}.${PRESET_EXT}`;

const isTint = (v: unknown): v is AvatarTint =>
	(AVATAR_TINTS as readonly unknown[]).includes(v);

/** A seed the server will accept: trimmed, lower case, 1 to 40 characters. Null when empty. */
export function cleanSeed(raw: string): string | null {
	const seed = avatarSeed(raw).slice(0, SEED_MAX).trim();
	return seed === "" ? null : seed;
}

/** The body for PUT /api/agents/{id}/avatar. */
export function toAvatarBody(choice: AvatarChoice) {
	return choice.kind === "preset"
		? { avatar: { kind: "preset" as const, ref: choice.id } }
		: {
				avatar: {
					kind: "dicebear" as const,
					ref: { seed: choice.seed, bg: choice.bg },
				},
			};
}

/** Reads what the server stored. Anything unknown is null, so the caller can fall back. */
export function fromServerAvatar(
	kind: unknown,
	ref: unknown,
): AvatarChoice | null {
	if (kind === "preset")
		return isPresetId(ref) ? { kind: "preset", id: ref } : null;
	if (kind === "dicebear" && typeof ref === "object" && ref !== null) {
		const { seed, bg } = ref as { seed?: unknown; bg?: unknown };
		if (typeof seed !== "string" || cleanSeed(seed) !== seed || !isTint(bg))
			return null;
		return { kind: "dicebear", seed, bg };
	}
	return null;
}

/** The server's answer to the avatar save: { avatarKind, avatarRef }. */
export function parseAvatarSaved(json: unknown): AvatarChoice | null {
	if (typeof json !== "object" || json === null) return null;
	const r = json as { avatarKind?: unknown; avatarRef?: unknown };
	return fromServerAvatar(r.avatarKind, r.avatarRef);
}

/** A first guess before the owner picks anything: a generated face from the agent's name. */
export function suggestAvatar(name: string): AvatarChoice | null {
	const seed = cleanSeed(name);
	return seed ? { kind: "dicebear", seed, bg: avatarTint(seed) } : null;
}

/** A random generated face. `rng` returns a number in [0, 1), so tests can pass their own. */
export function shuffleFace(rng: () => number = Math.random): AvatarChoice {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789";
	let seed = "";
	for (let i = 0; i < 8; i++)
		seed += letters[Math.floor(rng() * letters.length) % letters.length];
	const bg = AVATAR_TINTS[
		Math.floor(rng() * AVATAR_TINTS.length) % AVATAR_TINTS.length
	] as AvatarTint;
	return { kind: "dicebear", seed, bg };
}

export function sameAvatar(
	a: AvatarChoice | null,
	b: AvatarChoice | null,
): boolean {
	if (!a || !b) return a === b;
	if (a.kind === "preset" && b.kind === "preset") return a.id === b.id;
	if (a.kind === "dicebear" && b.kind === "dicebear")
		return a.seed === b.seed && a.bg === b.bg;
	return false;
}
