import { type Graph, project, pulsePath } from "./market-graph";
export function pulseRoute(g: Graph) {
	const hubs = g.nodes.filter((n) => n.kind === "hub").map((n) => n.id);
	let best: number[] = [];
	for (let i = 0; i < hubs.length; i++)
		for (let j = i + 1; j < hubs.length; j++) {
			const p = pulsePath(g, hubs[i] ?? 0, hubs[j] ?? 0);
			if (p.length > best.length) best = p;
		}
	return best;
}
export function posterShapes(g: Graph, width: number, height: number) {
	const at = g.nodes.map((n) => project(n, width, height));
	const lines = g.links.map(([a, b]) => ({
		x1: at[a]?.x ?? 0,
		y1: at[a]?.y ?? 0,
		x2: at[b]?.x ?? 0,
		y2: at[b]?.y ?? 0,
	}));
	const dots = g.nodes.map((n, i) => ({
		id: n.id,
		x: at[i]?.x ?? 0,
		y: at[i]?.y ?? 0,
		r: at[i]?.r ?? 3,
		hub: n.kind === "hub",
	}));
	const pts = pulseRoute(g)
		.map((id) => at[id])
		.filter((p): p is NonNullable<typeof p> => Boolean(p));
	const head = pts[Math.floor(pts.length / 2)] ?? {
		x: width / 2,
		y: height / 2,
	};
	return {
		width,
		height,
		lines,
		dots,
		pulse: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
		pulseHead: head,
	};
}
