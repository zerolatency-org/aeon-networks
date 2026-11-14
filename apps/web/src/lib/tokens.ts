// apps/web/src/lib/tokens.ts
// Names only. The values live in src/styles/tokens.css and nowhere else.

export const COLOR_TOKENS = [
	"canvas",
	"surface-1",
	"surface-2",
	"surface-3",
	"border",
	"border-strong",
	"text",
	"text-2",
	"text-3",
	"lumen",
	"lumen-ink",
	"lumen-fg",
	"tide",
	"iris",
	"ember",
	"coral",
	"moss",
] as const;

export const MEANING_TOKENS = [
	"tide",
	"iris",
	"ember",
	"coral",
	"moss",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
