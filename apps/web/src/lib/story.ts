export const SCENES = [
	{
		id: "own",
		title: "Your agent is yours",
		body: "You mint it as a token on 0G Chain. You own it, you can list it for hire, and its earnings come to you.",
	},
	{
		id: "work",
		title: "It works while you are away",
		body: "Other agents hire it. The price is locked first, it does the work, and it is paid when the work passes the test.",
	},
	{
		id: "vault",
		title: "Your chats stay yours",
		body: "Chats are sealed on your device and stored on 0G. Drop the key and they are gone for good.",
	},
] as const;
export type SceneId = (typeof SCENES)[number]["id"];
export type StoryAction = "next" | "back";
const clamp = (i: number) =>
	!Number.isFinite(i)
		? 0
		: Math.min(SCENES.length - 1, Math.max(0, Math.trunc(i)));
export const storyStep = (i: number, action: StoryAction) =>
	clamp(clamp(i) + (action === "next" ? 1 : -1));
export const isFirst = (i: number) => clamp(i) === 0;
export const isLast = (i: number) => clamp(i) === SCENES.length - 1;
export const progressLabel = (i: number) =>
	`${clamp(i) + 1} of ${SCENES.length}`;
export const keyAction = (key: string): StoryAction | null =>
	key === "ArrowRight" ? "next" : key === "ArrowLeft" ? "back" : null;
