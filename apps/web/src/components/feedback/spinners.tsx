// apps/web/src/components/feedback/spinners.tsx
"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useDelayedVisible } from "./use-delayed-visible";

export type SpinnerProps = {
	size?: 16 | 20 | 24;
	label?: string;
	/** Milliseconds before the spinner appears. Default 300. */
	delay?: number;
	className?: string;
};

function Frame({
	size,
	label,
	className,
	children,
}: {
	size: number;
	label: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<svg
			role="status"
			aria-label={label}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={cn("spinner shrink-0", className)}
		>
			{children}
		</svg>
	);
}

/** An agent is thinking or running tools. */
export function Orbit({
	size = 20,
	label = "Agent is working",
	delay = 300,
	className,
}: SpinnerProps) {
	const visible = useDelayedVisible(delay);
	if (!visible) return null;
	return (
		<Frame size={size} label={label} className={cn("text-iris", className)}>
			<circle cx="12" cy="12" r="2" fill="currentColor" />
			<g className="spin-orbit" fill="currentColor">
				<circle cx="12" cy="4" r="1.6" />
				<circle cx="18.9" cy="16" r="1.6" />
				<circle cx="5.1" cy="16" r="1.6" />
			</g>
		</Frame>
	);
}

/** Encrypting or decrypting: the shackle draws closed, then reopens. */
export function Seal({
	size = 20,
	label = "Encrypting",
	delay = 300,
	className,
}: SpinnerProps) {
	const visible = useDelayedVisible(delay);
	if (!visible) return null;
	return (
		<Frame size={size} label={label} className={className}>
			<rect
				x="6"
				y="11"
				width="12"
				height="9"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				className="spin-seal-shackle"
				d="M9 11V8a3 3 0 0 1 6 0v3"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</Frame>
	);
}

/** Uploading to or reading from 0G Storage: three bars light in turn. */
export function Relay({
	size = 20,
	label = "Syncing with 0G Storage",
	delay = 300,
	className,
}: SpinnerProps) {
	const visible = useDelayedVisible(delay);
	if (!visible) return null;
	return (
		<Frame size={size} label={label} className={cn("text-tide", className)}>
			{[5, 10.5, 16].map((x, i) => (
				<rect
					key={x}
					className="spin-relay-bar"
					style={{ animationDelay: `${i * 150}ms` }}
					x={x}
					y="6"
					width="3"
					height="12"
					rx="1"
					fill="currentColor"
				/>
			))}
		</Frame>
	);
}

/** Any other short wait: one line that draws and erases. */
export function Ink({
	size = 20,
	label = "Loading",
	delay = 300,
	className,
}: SpinnerProps) {
	const visible = useDelayedVisible(delay);
	if (!visible) return null;
	return (
		<Frame size={size} label={label} className={className}>
			<path
				className="spin-ink"
				pathLength={24}
				d="M4 14c3-6 5 4 8-1s5 3 8-2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</Frame>
	);
}
