import { createAvatar } from "@dicebear/core";
import * as openPeeps from "@dicebear/open-peeps";
import { type AvatarTint, avatarSeed, avatarTint } from "@/lib/avatar";

const TINT: Record<AvatarTint, string> = {
	tide: "bg-tide/12",
	iris: "bg-iris/12",
	ember: "bg-ember/12",
	coral: "bg-coral/12",
	moss: "bg-moss/12",
	lumen: "bg-lumen/12",
};
export function AgentAvatar({
	id,
	name,
	size = 56,
}: {
	id: string;
	name: string;
	size?: number;
}) {
	const src = createAvatar(openPeeps, { seed: avatarSeed(id) }).toDataUri();
	return (
		<span
			className={`inline-flex shrink-0 overflow-hidden rounded-full ${TINT[avatarTint(id)]}`}
			style={{ width: size, height: size }}
		>
			{/* biome-ignore lint/performance/noImgElement: DiceBear returns a data URI and must remain server-rendered. */}
			<img src={src} alt={`${name} avatar`} width={size} height={size} />
		</span>
	);
}
