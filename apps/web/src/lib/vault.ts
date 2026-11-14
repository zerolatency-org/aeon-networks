export type VaultEvent =
	| { type: "local" }
	| { type: "encrypting" }
	| { type: "uploading"; progress: number }
	| { type: "uploaded"; root: string }
	| { type: "anchoring" }
	| { type: "anchored"; tx: string }
	| { type: "key_dropped" };
export type VaultPhase =
	| "local"
	| "encrypting"
	| "uploading"
	| "uploaded"
	| "anchoring"
	| "anchored"
	| "deleted";
export type VaultState = {
	phase: VaultPhase;
	progress: number;
	root: string | null;
	tx: string | null;
	readable: boolean;
};
export const VAULT_START: VaultState = {
	phase: "local",
	progress: 0,
	root: null,
	tx: null,
	readable: true,
};
const ORDER: VaultPhase[] = [
	"local",
	"encrypting",
	"uploading",
	"uploaded",
	"anchoring",
	"anchored",
	"deleted",
];
const rank = (p: VaultPhase) => ORDER.indexOf(p);
export const reached = (s: VaultState, p: VaultPhase) =>
	rank(s.phase) >= rank(p);
const advance = (
	s: VaultState,
	phase: VaultPhase,
	patch: Partial<VaultState> = {},
) => (rank(phase) < rank(s.phase) ? s : { ...s, ...patch, phase });
export function reduceVault(s: VaultState, e: VaultEvent): VaultState {
	switch (e.type) {
		case "local":
			return VAULT_START;
		case "encrypting":
			return advance(s, "encrypting");
		case "uploading":
			return advance(s, "uploading", {
				progress: Math.min(
					1,
					Math.max(s.progress, Number.isFinite(e.progress) ? e.progress : 0),
				),
			});
		case "uploaded":
			return e.root ? advance(s, "uploaded", { progress: 1, root: e.root }) : s;
		case "anchoring":
			return advance(s, "anchoring");
		case "anchored":
			return e.tx ? advance(s, "anchored", { tx: e.tx }) : s;
		case "key_dropped":
			return s.phase === "anchored"
				? advance(s, "deleted", { readable: false })
				: s;
	}
}
export type TimedEvent = { at: number; event: VaultEvent };
export const DEMO_SCRIPT: readonly TimedEvent[] = [
	{ at: 0, event: { type: "local" } },
	{ at: 1400, event: { type: "encrypting" } },
	{ at: 2600, event: { type: "uploading", progress: 0.2 } },
	{ at: 3100, event: { type: "uploading", progress: 0.55 } },
	{ at: 3600, event: { type: "uploading", progress: 0.9 } },
	{ at: 4000, event: { type: "uploaded", root: "0x9f3ac71e55b0d2e8" } },
	{ at: 5000, event: { type: "anchoring" } },
	{ at: 6000, event: { type: "anchored", tx: "0x3eb4d19c07f2a2aB" } },
	{ at: 8500, event: { type: "key_dropped" } },
];
export const DEMO_LOOP_MS = 11500;
export const DEMO_STILL_MS = 7000;
export function stateAt(script: readonly TimedEvent[], ms: number) {
	return script
		.filter((x) => x.at <= ms)
		.reduce((state, timed) => reduceVault(state, timed.event), VAULT_START);
}
export const shortHash = (hash: string) =>
	hash.length > 12 ? `${hash.slice(0, 5)}…${hash.slice(-4)}` : hash;
export function phaseCaption(s: VaultState) {
	switch (s.phase) {
		case "local":
			return "Your chats start on this device.";
		case "encrypting":
			return "They are sealed with a key only you hold.";
		case "uploading":
			return `Sealed copies travel to 0G Storage, ${Math.round(s.progress * 100)}%.`;
		case "uploaded":
			return "Stored across 0G nodes as unreadable chunks.";
		case "anchoring":
			return "The archive's fingerprint is being written on chain.";
		case "anchored":
			return s.tx
				? `Anchored on 0G Chain, tx ${shortHash(s.tx)}.`
				: "Anchored on 0G Chain.";
		case "deleted":
			return "Drop the key and the archive is unreadable. Even to us.";
	}
}
