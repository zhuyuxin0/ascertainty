"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

/**
 * Visual-only car positioned by interpolating along the track centerline
 * by `car.fraction`. Used for race replay (event-driven). Physics-based
 * Vehicle.tsx is kept for the /race/test playground page only.
 */
export function RaceCar({
  car,
  track,
  index,
}: {
  car: CarState;
  track: TrackGeometry;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetFraction = useRef(car.fraction);
  const currentFraction = useRef(car.fraction);

  // Update target whenever car.fraction changes
  targetFraction.current = car.fraction;

  // Pre-compute lateral offset so multiple cars don't overlap
  const lateralOffset = useMemo(() => (index - 1) * 1.6, [index]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // Smoothly approach the target fraction
    const easing = car.status === "crashed" ? 0 : 2.0;
    currentFraction.current = THREE.MathUtils.lerp(
      currentFraction.current,
      targetFraction.current,
      Math.min(1, delta * easing),
    );

    const f = THREE.MathUtils.clamp(currentFraction.current, 0, 0.999);
    const idx = f * (track.centerlinePoints.length - 1);
    const i = Math.floor(idx);
    const t = idx - i;
    const a = track.centerlinePoints[i];
    const b = track.centerlinePoints[Math.min(i + 1, track.centerlinePoints.length - 1)];
    const pos = a.clone().lerp(b, t);

    // tangent for heading
    const next =
      track.centerlinePoints[Math.min(i + 2, track.centerlinePoints.length - 1)];
    const heading = next.clone().sub(a).normalize();

    // perpendicular for lateral offset (left/right shift per car index)
    const up = new THREE.Vector3(0, 1, 0);
    const side = heading.clone().cross(up).normalize();
    pos.addScaledVector(side, lateralOffset);

    pos.y += 0.45; // ride height

    // Crash: tumble down + spin out
    if (car.status === "crashed") {
      pos.y -= 0.35;
      groupRef.current.rotation.z += delta * 1.2;
      groupRef.current.position.copy(pos);
      return;
    }

    // Pitting: dim opacity (visual cue) — tilt down slightly
    const tiltAmount = car.status === "pitting" ? -0.1 : 0;
    const wobble = car.wobble * Math.sin(state.clock.elapsedTime * 30) * 0.15;

    groupRef.current.position.copy(pos);
    const yaw = Math.atan2(heading.x, heading.z);
    groupRef.current.rotation.set(tiltAmount, yaw, wobble);
  });

  // Finish flash
  const isFinished = car.status === "finished";

  return (
    <group ref={groupRef}>
      {/* chassis */}
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.4, 2.6]} />
        <meshStandardMaterial
          color="#0a0a10"
          emissive={car.color}
          emissiveIntensity={isFinished ? 1.5 : 0.5}
          metalness={0.7}
          roughness={0.3}
          opacity={car.status === "pitting" ? 0.7 : 1}
          transparent={car.status === "pitting"}
        />
      </mesh>
      {/* glowing accent strip on top */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.25, 0.04, 1.8]} />
        <meshBasicMaterial color={car.color} toneMapped={false} />
      </mesh>
      {/* tail glow / position light */}
      <mesh position={[0, 0.1, -1.35]}>
        <boxGeometry args={[1.0, 0.12, 0.05]} />
        <meshBasicMaterial color={car.color} toneMapped={false} />
      </mesh>
      {/* simple wheels (purely cosmetic — no physics) */}
      {[-0.65, 0.65].map((x) =>
        [-0.9, 0.9].map((z) => (
          <mesh key={`${x},${z}`} position={[x, -0.12, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.18, 14]} />
            <meshStandardMaterial color="#181820" roughness={0.7} />
          </mesh>
        )),
      )}
    </group>
  );
}
