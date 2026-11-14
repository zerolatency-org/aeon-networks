// apps/web/src/lib/wallet-theme.ts
// Colors for the RainbowKit modal. Every value points at an Aeon token, so the
// modal follows the theme and no color is written down twice.

export const WALLET_COLORS = {
	accentColor: "var(--lumen)",
	accentColorForeground: "var(--lumen-ink)",
	actionButtonSecondaryBackground: "var(--surface-2)",
	closeButton: "var(--text-2)",
	closeButtonBackground: "var(--surface-2)",
	connectionIndicator: "var(--moss)",
	error: "var(--coral)",
	generalBorder: "var(--border)",
	menuItemBackground: "var(--surface-2)",
	modalBackground: "var(--surface-1)",
	modalBorder: "var(--border)",
	modalText: "var(--text)",
	modalTextDim: "var(--text-3)",
	modalTextSecondary: "var(--text-2)",
	profileForeground: "var(--surface-2)",
	selectedOptionBorder: "var(--lumen)",
	standby: "var(--ember)",
} as const;
