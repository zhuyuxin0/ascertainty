"use client";

import { useMemo } from "react";
import { useTrimesh } from "@react-three/cannon";
import * as THREE from "three";

import { buildTrack, type DependencyGraph, type TrackGeometry } from "@/lib/trackMapping";

/**
 * Renders a track from a dependency graph. The road is a static trimesh
 * for cannon-es so the vehicle's RaycastVehicle has something to drive
 * on; lane markers are rendered as glowing dots either side.
 */
export function Track({ graph, onReady }: { graph: DependencyGraph; onReady?: (track: TrackGeometry) => void }) {
  const track = useMemo(() => {
    const t = buildTrack(graph);
    if (onReady) onReady(t);
    return t;
  }, [graph, onReady]);

  return (
    <group>
      <RoadCollider geometry={track.roadMesh} />
      <RoadVisual geometry={track.roadMesh} />
      <LaneMarkers points={track.laneMarkers} />
      <FinishLine point={track.finishPoint} />
    </group>
  );
}

function RoadVisual({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#0a0a10" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoadCollider({ geometry }: { geometry: THREE.BufferGeometry }) {
  // Extract vertices + indices for trimesh collision. The road is static —
  // the vehicle interacts via raycast suspension, so the trimesh is purely
  // a friction surface.
  const { vertices, indices } = useMemo(() => {
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = geometry.getIndex();
    const verts: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    return {
      vertices: verts,
      indices: idx ? Array.from(idx.array) : [],
    };
  }, [geometry]);

  const [ref] = useTrimesh(
    () => ({
      args: [vertices, indices],
      type: "Static",
      position: [0, 0.01, 0],
      material: { friction: 0.6 },
    }),
  );

  return <group ref={ref as React.Ref<THREE.Group>} />;
}

function LaneMarkers({ points }: { points: THREE.Vector3[] }) {
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.18, 0.04, 0.6]} />
          <meshBasicMaterial color="#00d4aa" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function FinishLine({ point }: { point: THREE.Vector3 }) {
  return (
    <group position={point}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[6, 0.08, 0.12]} />
        <meshBasicMaterial color="#ff6b35" toneMapped={false} />
      </mesh>
      <mesh position={[-3, 0.75, 0]}>
        <boxGeometry args={[0.12, 1.5, 0.12]} />
        <meshStandardMaterial color="#1a1a22" />
      </mesh>
      <mesh position={[3, 0.75, 0]}>
        <boxGeometry args={[0.12, 1.5, 0.12]} />
        <meshStandardMaterial color="#1a1a22" />
      </mesh>
    </group>
  );
}
