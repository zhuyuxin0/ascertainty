"use client";

import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

/**
 * Visual-only car positioned by interpolating along the track centerline
 * by `car.fraction`. Used for race replay (event-driven). The body is a
 * tapered extruded shape — wider at the back, sharper at the front,
 * matching the silhouette of a low-poly arcade racer.
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
  const trailAnchor = useRef<THREE.Mesh>(null);
  const targetFraction = useRef(car.fraction);
  const currentFraction = useRef(car.fraction);
  const crashSettled = useRef(false);
  const crashStartTs = useRef<number | null>(null);
  targetFraction.current = car.fraction;

  const lateralOffset = useMemo(() => (index - 1) * 1.7, [index]);
  const bodyGeometry = useMemo(() => buildCarBody(), []);

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
    pos.y += 0.42;

    if (car.status === "crashed") {
      // One-shot tumble: spin for ~1.5s, then settle on its side and stop.
      if (crashStartTs.current === null) {
        crashStartTs.current = state.clock.elapsedTime;
        crashSettled.current = false;
      }
      const t = state.clock.elapsedTime - crashStartTs.current;
      if (!crashSettled.current && t < 1.5) {
        const yaw = Math.atan2(heading.x, heading.z);
        groupRef.current.rotation.set(0, yaw, t * 4); // tip over fast
      } else if (!crashSettled.current) {
        // Settle: car is on its side, slight smoke-puff jitter, then freeze
        const yaw = Math.atan2(heading.x, heading.z);
        groupRef.current.rotation.set(0, yaw, Math.PI / 2);
        crashSettled.current = true;
      }
      pos.y -= 0.25;
      groupRef.current.position.copy(pos);
      return;
    }
    // Reset crash trackers if we somehow re-enter racing
    crashStartTs.current = null;
    crashSettled.current = false;

    const tiltAmount = car.status === "pitting" ? -0.12 : 0;
    const wobble = car.wobble * Math.sin(state.clock.elapsedTime * 30) * 0.18;
    const bounce = Math.sin(state.clock.elapsedTime * 8 + index) * 0.015;

    groupRef.current.position.copy(pos);
    groupRef.current.position.y += bounce;
    const yaw = Math.atan2(heading.x, heading.z);
    groupRef.current.rotation.set(tiltAmount, yaw, wobble);
  });

  const isFinished = car.status === "finished";
  const isMoving = car.status === "racing" || car.status === "pitting";
  const opacity = car.status === "pitting" ? 0.75 : 1;

  return (
    <group ref={groupRef}>
      {/* dust trail anchor — sits at the back of the car */}
      {isMoving && (
        <Trail
          width={1.4}
          length={4}
          color={car.color}
          attenuation={(t) => t * t}
          decay={3}
          local={false}
          stride={0}
          interval={1}
        >
          <mesh ref={trailAnchor} position={[0, 0.12, -1.4]} visible={false}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshBasicMaterial color={car.color} />
          </mesh>
        </Trail>
      )}

      {/* main body — tapered extrusion */}
      <mesh geometry={bodyGeometry} castShadow position={[0, 0.04, 0]}>
        <meshPhysicalMaterial
          color="#08080d"
          emissive={car.color}
          emissiveIntensity={isFinished ? 1.6 : 0.55}
          metalness={0.85}
          roughness={0.18}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          transparent={car.status === "pitting"}
          opacity={opacity}
        />
      </mesh>

      {/* glowing accent strip on top spine */}
      <mesh position={[0, 0.4, 0.1]}>
        <boxGeometry args={[0.18, 0.04, 1.6]} />
        <meshBasicMaterial color={car.color} toneMapped={false} />
      </mesh>

      {/* headlights — two glowing quads at the front */}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.18, 1.32]}>
          <boxGeometry args={[0.32, 0.12, 0.06]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* tail glow strip — full-width brake light */}
      <mesh position={[0, 0.18, -1.36]}>
        <boxGeometry args={[1.18, 0.16, 0.06]} />
        <meshBasicMaterial color={car.color} toneMapped={false} />
      </mesh>

      {/* underglow — soft band of light beneath the chassis */}
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 2.6]} />
        <meshBasicMaterial color={car.color} transparent opacity={0.18} toneMapped={false} />
      </mesh>

      {/* wheels — beveled cylinders, slightly larger */}
      {[-0.7, 0.7].map((x) =>
        [-0.95, 0.95].map((z) => (
          <Wheel key={`${x},${z}`} position={[x, -0.12, z]} />
        )),
      )}

      {/* finished: a soft halo around the car instead of a vertical beam */}
      {isFinished && (
        <pointLight position={[0, 1.2, 0]} intensity={2.5} color={car.color} distance={8} decay={1.4} />
      )}
    </group>
  );
}

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.22, 18]} />
        <meshStandardMaterial color="#0c0c12" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* hub accent */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.24, 12]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Tapered car body using THREE.Shape + ExtrudeGeometry.
 * Top-down outline: wider at the rear, narrower at the front, with
 * cut corners. Extruded vertically with bevels for soft edges.
 */
function buildCarBody(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Outline (top-down view, +z is forward)
  // start back-left, go forward
  shape.moveTo(-0.6, -1.3);
  shape.lineTo(0.6, -1.3);
  shape.lineTo(0.7, -0.9);
  shape.lineTo(0.7, 0.6);
  shape.lineTo(0.55, 1.1);
  shape.lineTo(0.3, 1.4);
  shape.lineTo(-0.3, 1.4);
  shape.lineTo(-0.55, 1.1);
  shape.lineTo(-0.7, 0.6);
  shape.lineTo(-0.7, -0.9);
  shape.lineTo(-0.6, -1.3);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.5,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    curveSegments: 12,
  });
  // Lay flat (extrude defaults along +z; we want height in +y)
  geom.rotateX(-Math.PI / 2);
  // Center vertically
  geom.translate(0, 0, 0);
  geom.computeVertexNormals();
  return geom;
}
