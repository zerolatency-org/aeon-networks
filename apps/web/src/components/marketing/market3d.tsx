"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import * as THREE from "three";
import { buildGraph, pathPosition } from "@/lib/market-graph";
import { pulseRoute } from "@/lib/poster";

function Network() {
	const graph = useMemo(() => buildGraph(), []);
	const route = useMemo(() => pulseRoute(graph), [graph]);
	const group = useRef<Group>(null);
	const pulse = useRef<Mesh>(null);

	// Line positions buffer
	const linePositions = useMemo(
		() =>
			new Float32Array(
				graph.links.flatMap(([a, b]) => {
					// biome-ignore lint/style/noNonNullAssertion: graph links are generated from valid nodes.
					const p = graph.nodes[a]!;
					// biome-ignore lint/style/noNonNullAssertion: graph links are generated from valid nodes.
					const q = graph.nodes[b]!;
					return [p.x, p.y, p.z, q.x, q.y, q.z];
				}),
			),
		[graph],
	);

	// Triangle face geometry — one mesh per highlighted face
	const faceGeometries = useMemo(
		() =>
			graph.faces.map(([a, b, c]) => {
				const na = graph.nodes[a];
				const nb = graph.nodes[b];
				const nc = graph.nodes[c];
				if (!na || !nb || !nc) {
					throw new Error("market graph face references a missing node");
				}
				const geo = new THREE.BufferGeometry();
				geo.setAttribute(
					"position",
					new THREE.BufferAttribute(
						new Float32Array([
							na.x,
							na.y,
							na.z,
							nb.x,
							nb.y,
							nb.z,
							nc.x,
							nc.y,
							nc.z,
						]),
						3,
					),
				);
				return geo;
			}),
		[graph],
	);

	useFrame(({ clock }, delta) => {
		if (group.current) {
			group.current.rotation.y += delta * 0.25;
			// slight tilt so it looks properly 3-D
			group.current.rotation.x = 0.3;
		}
		const p = pathPosition(graph, route, (clock.elapsedTime % 5) / 5);
		pulse.current?.position.set(p.x, p.y, p.z);
	});

	return (
		<group ref={group}>
			{/* Green face fills */}
			{faceGeometries.map((geo) => (
				<mesh key={geo.uuid} geometry={geo}>
					<meshBasicMaterial
						color="white"
						transparent
						opacity={0.35}
						side={THREE.DoubleSide}
						depthWrite={false}
					/>
				</mesh>
			))}

			{/* Edges */}
			<lineSegments>
				<bufferGeometry>
					<bufferAttribute
						attach="attributes-position"
						args={[linePositions, 3]}
					/>
				</bufferGeometry>
				<lineBasicMaterial color="white" linewidth={2} />
			</lineSegments>

			{/* Nodes */}
			{graph.nodes.map((n) => (
				<mesh key={n.id} position={[n.x, n.y, n.z]}>
					<sphereGeometry args={[n.kind === "hub" ? 0.07 : 0.045, 16, 16]} />
					<meshBasicMaterial color={n.kind === "hub" ? "white" : "white"} />
				</mesh>
			))}

			{/* Node outlines (dark ring for hub nodes) */}
			{graph.nodes
				.filter((n) => n.kind === "hub")
				.map((n) => (
					<mesh key={`ring-${n.id}`} position={[n.x, n.y, n.z]}>
						<sphereGeometry args={[0.082, 16, 16]} />
						<meshBasicMaterial color="white" side={THREE.BackSide} />
					</mesh>
				))}

			{/* Travelling pulse */}
			<mesh ref={pulse}>
				<sphereGeometry args={[0.055, 16, 16]} />
				<meshBasicMaterial color="white" />
			</mesh>
		</group>
	);
}

export function Market3d({ onReady }: { onReady: () => void }) {
	return (
		<Canvas
			dpr={[1, 1.5]}
			camera={{ position: [0, 0, 3.2], fov: 42 }}
			gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
			onCreated={onReady}
			aria-hidden="true"
		>
			{/* Bright ambient so the dark-node colours read cleanly */}
			<ambientLight intensity={1.5} />
			<Network />
		</Canvas>
	);
}
