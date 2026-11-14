// apps/web/src/lib/nav.ts
// What the navbar and the command palette offer. Pure data and rules, no React.
import type { SessionState } from "./session";

type Status = SessionState["status"];

/** Pages in the navbar. Later phases append here: Jobs, Chats, and so on. */
export const NAV_ITEMS = [
	{ href: "/market", label: "Market" },
	{ href: "/agents", label: "Agents" },
	{ href: "/jobs", label: "Jobs" },
	{ href: "/chats", label: "Chats" },
] as const;

/** The nav pill follows the section, so /agents/12 still lights up Agents. */
export function isActive(pathname: string, href: string): boolean {
	const path = pathname.split(/[?#]/)[0] ?? "";
	return path === href || path.startsWith(`${href}/`);
}

// These pages draw their own header.
const WITHOUT_NAVBAR = ["/", "/login", "/lab", "/how-it-works"];

export function showNavbar(pathname: string): boolean {
	return !WITHOUT_NAVBAR.some((base) => isActive(pathname, base));
}

export function isCommandShortcut(e: {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
}): boolean {
	return e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
}

export type CommandRun =
	| { type: "navigate"; href: string }
	| { type: "signOut" }
	| { type: "theme" };

export type CommandItem = {
	id: string;
	label: string;
	group: "Go to" | "Account" | "Appearance";
	run: CommandRun;
};

/** The commands for this session, in display order. The palette and the mobile menu both use it. */
export function commandItems(status: Status): CommandItem[] {
	const signedIn = status === "ready" || status === "needs-wallet";
	const items: CommandItem[] = [
		{
			id: "home",
			label: "Home",
			group: "Go to",
			run: { type: "navigate", href: "/" },
		},
	];
	if (status === "ready") {
		for (const n of NAV_ITEMS) {
			items.push({
				id: n.label.toLowerCase(),
				label: n.label,
				group: "Go to",
				run: { type: "navigate", href: n.href },
			});
		}
	}
	if (signedIn) {
		items.push({
			id: "settings",
			label: "Settings",
			group: "Go to",
			run: { type: "navigate", href: "/settings" },
		});
	}
	if (status === "signed-out") {
		items.push({
			id: "sign-in",
			label: "Sign in",
			group: "Account",
			run: { type: "navigate", href: "/login" },
		});
	}
	if (status === "needs-wallet") {
		items.push({
			id: "link-wallet",
			label: "Link a wallet",
			group: "Account",
			run: { type: "navigate", href: "/login" },
		});
	}
	if (signedIn) {
		items.push({
			id: "sign-out",
			label: "Sign out",
			group: "Account",
			run: { type: "signOut" },
		});
	}
	items.push({
		id: "theme",
		label: "Switch theme",
		group: "Appearance",
		run: { type: "theme" },
	});
	return items;
}
