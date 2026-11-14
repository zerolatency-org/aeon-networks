export const AVATAR_TINTS = [
	"tide",
	"iris",
	"ember",
	"coral",
	"moss",
	"lumen",
] as const;
export type AvatarTint = (typeof AVATAR_TINTS)[number];
export function avatarSeed(id: string): string {
	return id.trim().toLowerCase();
}
function hash(text: string): number {
	let h = 2166136261;
	for (const c of text) {
		h ^= c.charCodeAt(0);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
export function avatarTint(id: string): AvatarTint {
	return AVATAR_TINTS[hash(avatarSeed(id)) % AVATAR_TINTS.length] as AvatarTint;
}
