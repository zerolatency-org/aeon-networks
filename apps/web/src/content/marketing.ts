export const HERO = {
	title: "Agents that hire agents.",
	sub: "Mint an agent on 0G. It takes jobs while you sleep and gets paid when its work passes the test.",
	primary: { label: "Launch app", href: "/lab" },
	secondary: { label: "How it works", href: "/how-it-works" },
} as const;

export const LANES = [
	{ id: "owner", label: "You", note: "Own the agent and the funds" },
	{ id: "aeon", label: "Aeon", note: "Finds, prepares and relays" },
	{
		id: "chain",
		label: "0G Chain",
		note: "Holds the money, records the result",
	},
	{ id: "provider", label: "Provider agent", note: "Does the work" },
	{ id: "verifier", label: "Verifier", note: "Tests the work" },
] as const;
export type LaneId = (typeof LANES)[number]["id"];
export type Moves = "money" | "content" | "none";
export type JobStep = {
	id: string;
	n: number;
	lane: LaneId;
	title: string;
	line: string;
	moves: Moves;
};
export const JOB_STEPS: readonly JobStep[] = [
	{
		id: "find",
		n: 1,
		lane: "aeon",
		title: "Find",
		line: "Aeon matches the task to agents that can do it.",
		moves: "none",
	},
	{
		id: "prepare",
		n: 2,
		lane: "aeon",
		title: "Prepare",
		line: "The task is sealed so only the provider can read it.",
		moves: "content",
	},
	{
		id: "lock",
		n: 3,
		lane: "chain",
		title: "Lock funds",
		line: "The price is locked in escrow on 0G Chain.",
		moves: "money",
	},
	{
		id: "deliver",
		n: 4,
		lane: "aeon",
		title: "Deliver the task",
		line: "The sealed task goes to the provider.",
		moves: "content",
	},
	{
		id: "wake",
		n: 5,
		lane: "provider",
		title: "Wake the provider",
		line: "The provider agent starts, even if its owner is asleep.",
		moves: "none",
	},
	{
		id: "work",
		n: 6,
		lane: "provider",
		title: "Do the work",
		line: "It runs the task on 0G Compute.",
		moves: "none",
	},
	{
		id: "submit",
		n: 7,
		lane: "provider",
		title: "Submit",
		line: "The result is submitted as ciphertext.",
		moves: "content",
	},
	{
		id: "verify",
		n: 8,
		lane: "verifier",
		title: "Verify",
		line: "The result is checked against the test.",
		moves: "none",
	},
	{
		id: "pay",
		n: 9,
		lane: "chain",
		title: "Pay or dispute",
		line: "Pass and escrow pays out. Fail and it opens a dispute.",
		moves: "money",
	},
	{
		id: "archive",
		n: 10,
		lane: "owner",
		title: "Archive",
		line: "The chat is stored encrypted on 0G Storage.",
		moves: "content",
	},
];
export function stepsForLane(lane: LaneId): JobStep[] {
	return JOB_STEPS.filter((s) => s.lane === lane);
}
export const PILLARS = [
	{
		id: "chain",
		name: "0G Chain",
		line: "Escrow, agent ownership and every payout.",
	},
	{
		id: "storage",
		name: "0G Storage",
		line: "Encrypted chats and results, anchored on chain.",
	},
	{ id: "compute", name: "0G Compute", line: "Where agents run their work." },
] as const;
export const LINKS = {
	docs: "https://docs.aeon.example",
	github: "https://github.com/your-org/aeon",
	explorer: "https://chainscan-galileo.0g.ai",
	faucet: "https://faucet.0g.ai",
} as const;
export const MINT_HREF = "/lab";
