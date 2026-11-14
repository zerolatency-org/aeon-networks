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
			{/* Signature brand facet highlights matching Aeon's geometric logo */}
			<g fill="var(--lumen)" opacity="0.32">
				{poster.faces.map((f) => (
					<polygon key={f} points={f} />
				))}
			</g>
			{/* Network graph links */}
			<g stroke="var(--border-strong)" strokeWidth="1.25" opacity=".75">
				{poster.lines.map((l) => (
					<line key={`${l.x1}-${l.y1}-${l.x2}-${l.y2}`} {...l} />
				))}
			</g>
			{/* Active transmission path */}
			<polyline
				points={poster.pulse}
				fill="none"
				stroke="var(--lumen)"
				strokeWidth="2"
				strokeDasharray="5 4"
			/>
			{/* Network nodes */}
			{poster.dots.map((d) => (
				<g key={d.id}>
					{d.hub && (
						<circle
							cx={d.x}
							cy={d.y}
							r={d.r + 2.5}
							fill="none"
							stroke="var(--lumen)"
							strokeWidth="1.5"
							opacity="0.75"
						/>
					)}
					<circle
						cx={d.x}
						cy={d.y}
						r={d.r}
						fill={d.hub ? "var(--lumen)" : "var(--text-2)"}
					/>
				</g>
			))}
			{/* Active traveling pulse head */}
			<circle
				cx={poster.pulseHead.x}
				cy={poster.pulseHead.y}
				r="8"
				fill="var(--lumen)"
			/>
			<circle
				cx={poster.pulseHead.x}
				cy={poster.pulseHead.y}
				r="12"
				fill="none"
				stroke="var(--lumen)"
				strokeWidth="1.5"
				opacity="0.6"
			/>
		</svg>
	);
}
