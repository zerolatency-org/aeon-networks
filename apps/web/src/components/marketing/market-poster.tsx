import { buildGraph } from "@/lib/market-graph";
import { posterShapes } from "@/lib/poster";

const poster = posterShapes(buildGraph(), 640, 520);
export function MarketPoster({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 640 520"
			role="img"
			aria-label="A network of agents linked to each other, with one job travelling between two of them"
			className={className}
		>
			<g stroke="var(--border-strong)" strokeWidth="1" opacity=".7">
				{poster.lines.map((l) => (
					<line key={`${l.x1}-${l.y1}-${l.x2}-${l.y2}`} {...l} />
				))}
			</g>
			<polyline
				points={poster.pulse}
				fill="none"
				stroke="var(--lumen)"
				strokeWidth="1.75"
			/>
			{poster.dots.map((d) => (
				<circle
					key={d.id}
					cx={d.x}
					cy={d.y}
					r={d.r}
					fill={d.hub ? "var(--text-2)" : "var(--text-3)"}
				/>
			))}
			<circle
				cx={poster.pulseHead.x}
				cy={poster.pulseHead.y}
				r="7"
				fill="var(--lumen)"
			/>
		</svg>
	);
}
