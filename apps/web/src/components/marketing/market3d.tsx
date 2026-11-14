"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import * as THREE from "three";
import { buildGraph, type Graph, pathPosition } from "@/lib/market-graph";
import { pulseRoute } from "@/lib/poster";

type ThemeColors = {
	face: string;
	faceOpacity: number;
	edge: string;
	hub: string;
	hubRing: string;
	agent: string;
	pulse: string;
};

function Network({ colors }: { colors: ThemeColors }) {
	const graph: Graph = useMemo(() => buildGraph(), []);
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
			(graph.faces ?? []).map(([a, b, c]) => {
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
			{/* Brand-colored facet fills matching Aeon logo */}
			{faceGeometries.map((geo) => (
				<mesh key={geo.uuid} geometry={geo}>
					<meshBasicMaterial
						color={colors.face}
						transparent
						opacity={colors.faceOpacity}
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
				<lineBasicMaterial color={colors.edge} linewidth={1.5} />
			</lineSegments>

			{/* Nodes */}
			{graph.nodes.map((n) => (
				<mesh key={n.id} position={[n.x, n.y, n.z]}>
					<sphereGeometry args={[n.kind === "hub" ? 0.07 : 0.045, 16, 16]} />
					<meshBasicMaterial
						color={n.kind === "hub" ? colors.hub : colors.agent}
					/>
				</mesh>
			))}

			{/* Node outlines (halo ring for hub nodes) */}
			{graph.nodes
				.filter((n) => n.kind === "hub")
				.map((n) => (
					<mesh key={`ring-${n.id}`} position={[n.x, n.y, n.z]}>
						<sphereGeometry args={[0.082, 16, 16]} />
						<meshBasicMaterial color={colors.hubRing} side={THREE.BackSide} />
					</mesh>
				))}

			{/* Travelling pulse */}
			<mesh ref={pulse}>
				<sphereGeometry args={[0.055, 16, 16]} />
				<meshBasicMaterial color={colors.pulse} />
			</mesh>
		</group>
	);
}

export function Market3d({ onReady }: { onReady: () => void }) {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme !== "light";

	const colors: ThemeColors = useMemo(() => {
		if (typeof window === "undefined") {
			return isDark
				? {
						face: "rgb(217, 242, 122)",
						faceOpacity: 0.35,
						edge: "rgb(58, 63, 70)",
						hub: "rgb(217, 242, 122)",
						hubRing: "rgb(20, 23, 10)",
						agent: "rgb(166, 169, 164)",
						pulse: "rgb(217, 242, 122)",
					}
				: {
						face: "rgb(217, 242, 122)",
						faceOpacity: 0.45,
						edge: "rgb(180, 178, 170)",
						hub: "rgb(23, 24, 26)",
						hubRing: "rgb(217, 242, 122)",
						agent: "rgb(85, 87, 79)",
						pulse: "rgb(77, 98, 0)",
					};
		}
		const cs = getComputedStyle(document.documentElement);
		const lumen = cs.getPropertyValue("--lumen").trim() || "rgb(217, 242, 122)";
		const lumenInk =
			cs.getPropertyValue("--lumen-ink").trim() || "rgb(20, 23, 10)";
		const lumenFg =
			cs.getPropertyValue("--lumen-fg").trim() || "rgb(77, 98, 0)";
		const borderStrong =
			cs.getPropertyValue("--border-strong").trim() ||
			(isDark ? "rgb(58, 63, 70)" : "rgb(180, 178, 170)");
		const text = cs.getPropertyValue("--text").trim() || "rgb(23, 24, 26)";
		const text2 =
			cs.getPropertyValue("--text-2").trim() ||
			(isDark ? "rgb(166, 169, 164)" : "rgb(85, 87, 79)");

		return isDark
			? {
					face: lumen,
					faceOpacity: 0.35,
					edge: borderStrong,
					hub: lumen,
					hubRing: lumenInk,
					agent: text2,
					pulse: lumen,
				}
			: {
					face: lumen,
					faceOpacity: 0.45,
					edge: borderStrong,
					hub: text,
					hubRing: lumen,
					agent: text2,
					pulse: lumenFg,
				};
	}, [isDark]);

	return (
		<Canvas
			dpr={[1, 1.5]}
			camera={{ position: [0, 0, 3.2], fov: 42 }}
			gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
			onCreated={onReady}
			aria-hidden="true"
		>
			<ambientLight intensity={isDark ? 1.4 : 1.8} />
			<Network colors={colors} />
		</Canvas>
	);
}
