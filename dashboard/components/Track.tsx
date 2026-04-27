"use client";

import { useMemo } from "react";
import { useTrimesh } from "@react-three/cannon";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

import { buildTrack, type DependencyGraph, type TrackGeometry } from "@/lib/trackMapping";

/**
 * Renders a track from a dependency graph. The road is a static trimesh
 * for cannon-es so the vehicle's RaycastVehicle has something to drive
 * on; surface uses MeshReflectorMaterial so cars cast soft reflections;
 * lane markers + centerline dashes glow along the spline.
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
      <CenterlineDashes dashes={track.centerlineDashes} />
      <FinishLine point={track.finishPoint} />
      <SpawnGate point={track.spawnPoint} heading={track.spawnHeading} />
    </group>
  );
}

function RoadVisual({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh receiveShadow geometry={geometry}>
      <MeshReflectorMaterial
        color="#0c0c14"
        metalness={0.6}
        roughness={0.55}
        blur={[400, 80]}
        mixBlur={1.2}
        mixStrength={1.5}
        mixContrast={1.0}
        resolution={512}
        mirror={0.6}
        depthScale={0.4}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function RoadCollider({ geometry }: { geometry: THREE.BufferGeometry }) {
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
          <boxGeometry args={[0.16, 0.05, 0.7]} />
          <meshBasicMaterial color="#00d4aa" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CenterlineDashes({ dashes }: { dashes: { position: THREE.Vector3; rotation: number }[] }) {
  return (
    <group>
      {dashes.map((d, i) => (
        <mesh key={i} position={d.position} rotation={[0, d.rotation, 0]}>
          <boxGeometry args={[0.14, 0.03, 1.4]} />
          <meshBasicMaterial color="#00d4aa" toneMapped={false} transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function FinishLine({ point }: { point: THREE.Vector3 }) {
  return (
    <group position={point}>
      {/* checkered banner */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[7, 0.12, 0.16]} />
        <meshBasicMaterial color="#ff6b35" toneMapped={false} />
      </mesh>
      {/* posts */}
      <mesh position={[-3.5, 0.9, 0]}>
        <boxGeometry args={[0.16, 1.8, 0.16]} />
        <meshStandardMaterial color="#1a1a22" emissive="#ff6b35" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[3.5, 0.9, 0]}>
        <boxGeometry args={[0.16, 1.8, 0.16]} />
        <meshStandardMaterial color="#1a1a22" emissive="#ff6b35" emissiveIntensity={0.3} />
      </mesh>
      {/* ground accent */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.5, 0.4]} />
        <meshBasicMaterial color="#ff6b35" toneMapped={false} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function SpawnGate({ point, heading }: { point: THREE.Vector3; heading: THREE.Vector3 }) {
  const yaw = Math.atan2(heading.x, heading.z);
  return (
    <group position={point} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.5, 0.3]} />
        <meshBasicMaterial color="#00d4aa" toneMapped={false} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
