"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTrimesh } from "@react-three/cannon";
import { MeshReflectorMaterial } from "@react-three/drei";
import CustomShaderMaterial from "three-custom-shader-material";
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
      <RoadOverlay geometry={track.roadMesh} />
      <LaneMarkers points={track.laneMarkers} />
      <FinishLine point={track.finishPoint} />
      <SpawnGate point={track.spawnPoint} heading={track.spawnHeading} />
    </group>
  );
}

function RoadVisual({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh receiveShadow geometry={geometry}>
      <MeshReflectorMaterial
        color="#0a0a12"
        metalness={0.5}
        roughness={0.6}
        blur={[300, 100]}
        mixBlur={1.0}
        mixStrength={0.8}
        mixContrast={1.0}
        resolution={512}
        mirror={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Overlay layer 0.01 units above the road surface. Adds scrolling
 * dashed centerline + fresnel edge glow via three-custom-shader-material
 * patching MeshStandardMaterial. Both effects write to csm_Emissive so
 * the EffectComposer's bloom catches the glow without lighting up the
 * dark asphalt itself.
 */
function RoadOverlay({ geometry }: { geometry: THREE.BufferGeometry }) {
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uScrollSpeed: { value: 0.6 },
  });

  useFrame((_, delta) => {
    uniformsRef.current.uTime.value += delta;
  });

  // Push the overlay geometry slightly upward to avoid z-fighting
  const lifted = useMemo(() => {
    const g = geometry.clone();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + 0.012);
    }
    pos.needsUpdate = true;
    return g;
  }, [geometry]);

  return (
    <mesh geometry={lifted}>
      <CustomShaderMaterial
        baseMaterial={THREE.MeshStandardMaterial}
        transparent
        side={THREE.DoubleSide}
        color="#000000"
        metalness={0}
        roughness={1}
        uniforms={uniformsRef.current}
        vertexShader={/* glsl */ `
          varying vec2 vCustomUv;
          void main() {
            vCustomUv = uv;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          uniform float uScrollSpeed;
          varying vec2 vCustomUv;

          void main() {
            // u: 0 = left edge, 1 = right edge
            // v: 0 = track start, 1 = track end
            float u = vCustomUv.x;
            float v = vCustomUv.y;

            // Fresnel-style edge glow on the road sides — main visual hook
            float edgeDist = abs(u - 0.5) * 2.0; // 0 at center, 1 at edge
            float edgeGlow = pow(smoothstep(0.55, 1.0, edgeDist), 1.4);

            // Subtle longitudinal pulse along the road — sweeps colour
            // through the edge glow rather than relying on quad-aligned dashes
            // which kink at curves. This reads as a "live circuit" feeling
            // even though it's just a continuous gradient.
            float pulse = 0.65 + 0.35 * sin(v * 6.2831 * 1.5 - uTime * 1.2);

            vec3 cyan = vec3(0.0, 0.83, 0.67);
            vec3 amber = vec3(1.0, 0.42, 0.21);

            float totalGlow = edgeGlow * (0.6 + 0.4 * pulse);
            vec3 emissive = cyan * totalGlow;
            emissive += amber * pow(smoothstep(0.93, 1.0, edgeDist), 2.0) * 0.6;

            float alpha = clamp(totalGlow + edgeGlow * 0.2, 0.0, 1.0);

            csm_DiffuseColor = vec4(0.0, 0.0, 0.0, alpha);
            csm_Emissive = emissive;
          }
        `}
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
