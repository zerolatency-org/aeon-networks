// apps/web/src/components/agents/agent-face.tsx
"use client";

import { notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useMemo } from "react";

import type { AvatarChoice } from "@/lib/agents-parse";
import { presetSrc } from "@/lib/avatar-choice";

export function AgentFace({
	face,
	size = 56,
}: {
	face: AvatarChoice;
	size?: number;
}) {
	const src = useMemo(
		() =>
			face.kind === "preset"
				? presetSrc(face.id)
				: createAvatar(notionists, { seed: face.seed }).toDataUri(),
		[face],
	);
	// A generated face sits on a soft tint of its meaning color; a preset image brings its own look.
	const tile =
		face.kind === "dicebear"
			? `color-mix(in oklab, var(--${face.bg}) 22%, transparent)`
			: "var(--surface-2)";
	return (
		<span
			className="inline-block shrink-0 overflow-hidden rounded-xl"
			style={{ width: size, height: size, background: tile }}
		>
			<img
				src={src}
				alt=""
				width={size}
				height={size}
				className="h-full w-full object-cover"
			/>
		</span>
	);
}
