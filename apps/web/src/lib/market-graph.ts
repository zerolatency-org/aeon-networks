export type GraphNode = {
	id: number;
	x: number;
	y: number;
	z: number;
	kind: "agent" | "hub";
};
export type Graph = {
	nodes: GraphNode[];
	links: [number, number][];
	faces: [number, number, number][];
};

// ---------------------------------------------------------------------------
// Icosahedron graph (12 vertices, 30 edges, 20 triangular faces)
// This matches the reference image: a hex-like outline with inner diagonals
// all forming equilateral triangles, rotating in 3-D.
// ---------------------------------------------------------------------------
export function buildGraph(): Graph {
	// Golden ratio
	const phi = (1 + Math.sqrt(5)) / 2;
	// Normalise so the circumradius ≈ 0.9 (fits the camera well)
	const scale = 0.9 / Math.sqrt(1 + phi * phi);

	// 12 icosahedron vertices from the 3 orthogonal golden rectangles
	const rawVerts: [number, number, number][] = [
		[-1, phi, 0],
		[1, phi, 0],
		[-1, -phi, 0],
		[1, -phi, 0],
		[0, -1, phi],
		[0, 1, phi],
		[0, -1, -phi],
		[0, 1, -phi],
		[phi, 0, -1],
		[phi, 0, 1],
		[-phi, 0, -1],
		[-phi, 0, 1],
	];

	const nodes: GraphNode[] = rawVerts.map(([x, y, z], i) => ({
		id: i,
		x: x * scale,
		y: y * scale,
		z: z * scale,
		// Vertices 0,1,5,7,9,11 are the "top belt" — mark as hub (bigger dot)
		kind: (i % 2 === 0 ? "hub" : "agent") as "hub" | "agent",
	}));

	// 20 triangular faces of the icosahedron
	const faces: [number, number, number][] = [
		// 5 faces around top vertex (1)
		[0, 11, 5],
		[0, 5, 1],
		[0, 1, 7],
		[0, 7, 10],
		[0, 10, 11],
		// 5 adjacent faces
		[1, 5, 9],
		[5, 11, 4],
		[11, 10, 2],
		[10, 7, 6],
		[7, 1, 8],
		// 5 faces around bottom vertex (3)
		[3, 9, 4],
		[3, 4, 2],
		[3, 2, 6],
		[3, 6, 8],
		[3, 8, 9],
		// 5 adjacent faces
		[4, 9, 5],
		[2, 4, 11],
		[6, 2, 10],
		[8, 6, 7],
		[9, 8, 1],
	];

	// Derive edges from faces (deduplicated)
	const seen = new Set<string>();
	const links: [number, number][] = [];
	for (const [a, b, c] of faces) {
		for (const [u, v] of [
			[a, b],
			[b, c],
			[a, c],
		] as [number, number][]) {
			const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
			if (!seen.has(key)) {
				seen.add(key);
				links.push([Math.min(u, v), Math.max(u, v)]);
			}
		}
	}

	// Pick 3 non-adjacent faces for the green highlight (spread around the shape)
	const topFront = faces[1];
	const midRight = faces[9];
	const bottomLeft = faces[14];
	if (!topFront || !midRight || !bottomLeft) {
		throw new Error("market graph did not generate enough faces");
	}
	const highlightFaces: [number, number, number][] = [
		topFront,
		midRight,
		bottomLeft,
	];

	return { nodes, links, faces: highlightFaces };
}

// ---------------------------------------------------------------------------
// Helpers (kept for compatibility with poster.ts / other consumers)
// ---------------------------------------------------------------------------
function adjacency(count: number, links: [number, number][]) {
	const out = Array.from({ length: count }, () => [] as number[]);
	for (const [a, b] of links) {
		out[a]?.push(b);
		out[b]?.push(a);
	}
	return out;
}

function components(count: number, links: [number, number][]) {
	const adj = adjacency(count, links);
	const seen = new Set<number>();
	const out: number[][] = [];
	for (let s = 0; s < count; s++) {
		if (seen.has(s)) continue;
		const group: number[] = [];
		const stack = [s];
		seen.add(s);
		while (stack.length) {
			const v = stack.pop();
			if (v === undefined) break;
			group.push(v);
			for (const w of adj[v] ?? [])
				if (!seen.has(w)) {
					seen.add(w);
					stack.push(w);
				}
		}
		out.push(group);
	}
	return out;
}

export function isConnected(g: Graph) {
	return components(g.nodes.length, g.links).length <= 1;
}

export function pulsePath(g: Graph, from: number, to: number) {
	const adj = adjacency(g.nodes.length, g.links);
	const prev = new Map([[from, from]]);
	const q = [from];
	while (q.length) {
		const v = q.shift();
		if (v === undefined) break;
		if (v === to) break;
		for (const w of adj[v] ?? [])
			if (!prev.has(w)) {
				prev.set(w, v);
				q.push(w);
			}
	}
	if (!prev.has(to)) return [];
	const path = [to];
	while (path[0] !== from) {
		const current = path[0];
		if (current === undefined) return [];
		const parent = prev.get(current);
		if (parent === undefined) return [];
		path.unshift(parent);
	}
	return path;
}

export function project(n: GraphNode, width: number, height: number) {
	const depth = 1 / (1.8 - n.z * 0.5);
	const scale = Math.min(width, height) * 0.42;
	return {
		x: width / 2 + n.x * scale * depth * 1.8,
		y: height / 2 - n.y * scale * depth * 1.8,
		r: (n.kind === "hub" ? 5 : 3) * (0.7 + depth),
	};
}

export function pathPosition(g: Graph, path: number[], t: number) {
	const pts = path
		.map((id) => g.nodes[id])
		.filter((n): n is GraphNode => Boolean(n));
	const first = pts[0];
	if (!first) return { x: 0, y: 0, z: 0 };
	if (pts.length === 1) return { x: first.x, y: first.y, z: first.z };
	const spot = Math.min(1, Math.max(0, t)) * (pts.length - 1);
	const i = Math.min(pts.length - 2, Math.floor(spot));
	const f = spot - i;
	const a = pts[i];
	const b = pts[i + 1];
	if (!a || !b) return { x: first.x, y: first.y, z: first.z };
	return {
		x: a.x + (b.x - a.x) * f,
		y: a.y + (b.y - a.y) * f,
		z: a.z + (b.z - a.z) * f,
	};
}
