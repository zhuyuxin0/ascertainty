"use client";

import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { KenneyCar } from "./KenneyCar";
import { FakeShadow } from "./FakeShadow";
import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

/**
 * Visual-only kinematic car driven by race events. Wraps a Kenney
 * low-poly body with a Bruno-style fake shadow plane underneath.
 *
 * Replaces RaceCarGLTF (Sketchfab muscle car) which read as too
 * realistic / muddy in the dark cyberpunk scene.
 */

export function RaceCarKenney({
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
  const crashStartTs = useRef<number | null>(null);
  const crashSettled = useRef(false);
  const carPos = useRef<[number, number, number]>([0, 0, 0]);
  const trackY = useRef(0); // track surface y at car's current position
  const carYaw = useRef(0);
  targetFraction.current = car.fraction;

  const lateralOffset = useMemo(() => (index - 1) * 2.4, [index]);
  // Cycle through Kenney's 3 picked silhouettes deterministically
  const modelIndex = index % 3;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const easing = car.status === "crashed" ? 0 : 2.4;
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
    const next = track.centerlinePoints[Math.min(i + 2, track.centerlinePoints.length - 1)];
    const heading = next.clone().sub(a).normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const side = heading.clone().cross(up).normalize();
    pos.addScaledVector(side, lateralOffset);
    trackY.current = pos.y; // capture track surface y BEFORE adding ride height
    pos.y += 0.04; // Kenney cars: wheels hang below model origin, near-zero offset puts them on the track

    if (car.status === "crashed") {
      if (crashStartTs.current === null) {
        crashStartTs.current = state.clock.elapsedTime;
        crashSettled.current = false;
      }
      const ct = state.clock.elapsedTime - crashStartTs.current;
      const yaw = Math.atan2(heading.x, heading.z);
      if (!crashSettled.current && ct < 1.5) {
        groupRef.current.rotation.set(0, yaw, ct * 4);
      } else if (!crashSettled.current) {
        groupRef.current.rotation.set(0, yaw, Math.PI / 2);
        crashSettled.current = true;
      }
      pos.y -= 0.15;
      groupRef.current.position.copy(pos);
      carPos.current = [pos.x, pos.y, pos.z];
      carYaw.current = yaw;
      return;
    }
    crashStartTs.current = null;
    crashSettled.current = false;

    const tilt = car.status === "pitting" ? -0.08 : 0;
    const wobble = car.wobble * Math.sin(state.clock.elapsedTime * 30) * 0.15;
    const bounce = Math.sin(state.clock.elapsedTime * 8 + index) * 0.012;

    groupRef.current.position.copy(pos);
    groupRef.current.position.y += bounce;
    const yaw = Math.atan2(heading.x, heading.z);
    groupRef.current.rotation.set(tilt, yaw, wobble);
    carPos.current = [pos.x, pos.y, pos.z];
    carYaw.current = yaw;
  });

  const isFinished = car.status === "finished";
  const isMoving = car.status === "racing" || car.status === "pitting";
  const isCrashed = car.status === "crashed";

  return (
    <>
      {/* Fake shadow at track-surface level — follows elevation changes */}
      <FakeShadow
        position={[carPos.current[0], trackY.current + 0.01, carPos.current[2]]}
        rotation={carYaw.current}
        alpha={isCrashed ? 0.4 : 0.7}
        size={3.4}
      />
      <group ref={groupRef}>
        {isMoving && (
          <Trail
            width={2.2}
            length={6}
            color={car.color}
            attenuation={(t) => t * t}
            decay={3}
            local={false}
            stride={0}
            interval={1}
          >
            <mesh position={[0, 0.3, -1.4]} visible={false}>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshBasicMaterial color={car.color} />
            </mesh>
          </Trail>
        )}

        <KenneyCar modelIndex={modelIndex} tint={car.color} dimmed={car.status === "pitting"} />

        {/* underglow band — sits just above the track surface so it always
            reads as a halo around the car, never as a rectangle on the floor */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.4, 2.6]} />
          <meshBasicMaterial
            color={car.color}
            transparent
            opacity={isMoving ? 0.18 : 0.08}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>

        {isFinished && (
          <pointLight
            position={[0, 1.2, 0]}
            intensity={3}
            color={car.color}
            distance={9}
            decay={1.4}
          />
        )}
      </group>
    </>
  );
}
