// apps/web/src/components/lab/lab-client.tsx
"use client";

import { MotionConfig, motion } from "motion/react";
import { type ReactNode, useState } from "react";

import { Logo, Wordmark } from "@/components/brand/logo";
import { Ink, Orbit, Relay, Seal } from "@/components/feedback/spinners";
import { ThemeSwitch } from "@/components/theme/theme-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Glass } from "@/components/ui/glass";
import { Skeleton } from "@/components/ui/skeleton";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";
import { COLOR_TOKENS } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const SLOW = [1, 3, 6] as const;

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: ReactNode;
}) {
	const id = `lab-${title.toLowerCase().replaceAll(" ", "-")}`;
	return (
		<section aria-labelledby={id} className="flex flex-col gap-4">
			<div>
				<h2
					id={id}
					className="font-serif text-[28px] leading-[34px] tracking-tight"
				>
					{title}
				</h2>
				{hint ? <p className="text-fg-2">{hint}</p> : null}
			</div>
			{children}
		</section>
	);
}

function MotionDemo() {
	const [right, setRight] = useState(false);
	return (
		<div className="flex flex-col gap-4">
			<Button className="self-start" onClick={() => setRight((v) => !v)}>
				Move the block
			</Button>
			<div className="border-border bg-surface-1 flex h-16 items-center rounded-lg border px-2">
				<motion.div
					layout
					transition={SPRING}
					className={cn("bg-iris size-10 rounded-md", right && "ml-auto")}
				/>
			</div>
			<motion.p
				key={String(right)}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: DURATION.base, ease: [...EASE_OUT] }}
				className="text-fg-2"
			>
				{right ? "Spring layout: moved right" : "Spring layout: at rest"}
			</motion.p>
		</div>
	);
}

export function LabClient() {
	const [slow, setSlow] = useState<(typeof SLOW)[number]>(1);

	return (
		<MotionConfig reducedMotion="user">
			<header className="glass sticky top-0 z-10 flex h-14 items-center gap-4 px-6">
				<div className="flex items-center gap-4">
					<Logo />
					<Wordmark />
				</div>
				<div className="ml-auto flex items-center gap-3">
					<fieldset
						aria-label="Whale speed"
						className="m-0 flex items-center gap-1 border-0 p-0"
					>
						<span className="text-fg-2 mr-1 text-[13px]">Whale speed</span>
						{SLOW.map((n) => (
							<Button
								key={n}
								size="sm"
								variant={slow === n ? "outline" : "ghost"}
								aria-pressed={slow === n}
								onClick={() => setSlow(n)}
							>
								{n}x
							</Button>
						))}
					</fieldset>
					<ThemeSwitch slow={slow} />
				</div>
			</header>

			<main className="mx-auto flex max-w-[1280px] flex-col gap-14 px-6 py-12">
				<h1 className="font-serif text-[56px] leading-[60px] tracking-tight">
					Component lab
				</h1>

				<Section
					title="Color"
					hint="Every token, in the current theme. Flip the theme to compare."
				>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
						{COLOR_TOKENS.map((token) => (
							<li key={token} className="flex flex-col gap-2">
								<div
									className="border-border-strong h-14 rounded-md border"
									style={{ background: `var(--${token})` }}
								/>
								<span className="num text-fg-2">{token}</span>
							</li>
						))}
					</ul>
				</Section>

				<Section
					title="Type"
					hint="Newsreader for titles, Instrument Sans for the interface, JetBrains Mono for numbers."
				>
					<div className="flex flex-col gap-3">
						<p className="font-serif text-[56px] leading-[60px] tracking-tight">
							Agents that hire agents.
						</p>
						<p className="font-serif text-[40px] leading-[44px] tracking-tight">
							Mint an agent on 0G
						</p>
						<p className="font-serif text-[28px] leading-[34px] tracking-tight">
							Your chats stay yours
						</p>
						<p className="text-[20px] leading-7 font-semibold">
							Section title in Instrument Sans
						</p>
						<p>
							Body text at 15 on 24. It works while you are away and gets paid
							when its work passes.
						</p>
						<p className="text-fg-2 text-[13px] leading-5">
							Small text at 13 on 20 for captions and help.
						</p>
						<p className="text-fg-2 text-[11px] leading-4 font-medium tracking-[0.06em] uppercase">
							Caps label
						</p>
						<p className="num">0x3eb…a2aB · 1.42 0G</p>
					</div>
				</Section>

				<Section
					title="Buttons"
					hint="One Lumen button per view. Everything else stays neutral."
				>
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="lumen">Launch app</Button>
						<Button>Default</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="danger">Delete</Button>
						<Button disabled>Disabled</Button>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button size="sm">Small</Button>
						<Button size="md">Medium</Button>
						<Button size="lg">Large</Button>
					</div>
				</Section>

				<Section
					title="Badges"
					hint="Status always carries a word. Color only adds meaning."
				>
					<div className="flex flex-wrap items-center gap-3">
						<Badge>Idle</Badge>
						<Badge tone="storage">Archived</Badge>
						<Badge tone="agent">Agent</Badge>
						<Badge tone="waiting">Waiting</Badge>
						<Badge tone="danger">Disputed</Badge>
						<Badge tone="done">Paid</Badge>
						<Badge tone="live">Live</Badge>
					</div>
				</Section>

				<Section
					title="Bento grid"
					hint="Solid cards on flat surfaces. No glass inside the page."
				>
					<div className="grid auto-rows-[120px] grid-cols-2 gap-3 md:grid-cols-4">
						<Card className="col-span-2 row-span-2 flex flex-col justify-between">
							<CardTitle>Agents</CardTitle>
							<p className="num text-fg-2">12 listed</p>
						</Card>
						<Card className="flex flex-col justify-between">
							<Badge tone="done">Paid</Badge>
							<p className="num">3.20 0G</p>
						</Card>
						<Card className="flex flex-col justify-between">
							<Badge tone="waiting">Waiting</Badge>
							<p className="num">2 approvals</p>
						</Card>
						<Card className="col-span-2 flex flex-col justify-between">
							<Badge tone="storage">Archived</Badge>
							<p className="num">0x3eb…a2aB</p>
						</Card>
					</div>
				</Section>

				<Section
					title="Glass"
					hint="Only for layers that float over content. The blocks behind it are flat."
				>
					<div className="border-border relative h-48 overflow-hidden rounded-xl border">
						<div className="bg-tide/20 absolute inset-y-0 left-0 w-1/3" />
						<div className="bg-iris/20 absolute inset-y-0 left-1/3 w-1/3" />
						<div className="bg-ember/20 absolute inset-y-0 right-0 w-1/3" />
						<Glass className="absolute inset-6 grid place-items-center">
							<p>A floating layer</p>
						</Glass>
					</div>
				</Section>

				<Section
					title="Spinners"
					hint="Shown at once here. In the app they wait 300 ms."
				>
					<div className="flex flex-wrap items-center gap-8">
						<div className="flex items-center gap-2">
							<Orbit delay={0} size={24} />
							<span className="text-fg-2">Orbit: agent working</span>
						</div>
						<div className="flex items-center gap-2">
							<Seal delay={0} size={24} />
							<span className="text-fg-2">Seal: encrypting</span>
						</div>
						<div className="flex items-center gap-2">
							<Relay delay={0} size={24} />
							<span className="text-fg-2">Relay: 0G Storage</span>
						</div>
						<div className="flex items-center gap-2">
							<Ink delay={0} size={24} />
							<span className="text-fg-2">Ink: loading</span>
						</div>
					</div>
				</Section>

				<Section title="Skeletons" hint="They pulse between two flat surfaces.">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-4 w-80 max-w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				</Section>

				<Section
					title="Motion"
					hint="Layout moves use the spring. Reduced motion turns movement into a short fade."
				>
					<MotionDemo />
				</Section>
			</main>
		</MotionConfig>
	);
}
