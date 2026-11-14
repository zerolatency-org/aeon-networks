// apps/web/src/content/avatars.ts
// The preset faces. Put the image files in apps/web/public/avatars/ named p01.webp to p20.webp.
// The ids are what the database stores in agents.avatar_ref (its default is "p01").

export const PRESET_COUNT = 20;
export const PRESET_EXT = "webp";

export const PRESET_IDS: readonly string[] = Array.from(
	{ length: PRESET_COUNT },
	(_, i) => `p${String(i + 1).padStart(2, "0")}`,
);
