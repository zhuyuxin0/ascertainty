"use client";

import { useFrame } from "@react-three/fiber";
import { useGLTF, Trail } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

/**
 * Race car using the open-source Classic Muscle Car GLTF (Sketchfab,
 * CC-BY-4.0, attributed in dashboard/lib/ATTRIBUTIONS.md). Adapted
 * from pmndrs/racing-game's Chassis.tsx + Wheel.tsx structure.
 *
 * The body paint is dynamically tinted to the solver's color; the rest
 * of the chassis materials (chrome, glass, brake lights, etc.) are kept
 * stock so the model still reads as a real car.
 */

const CHASSIS_URL = "/models/chassis-draco.glb";
const WHEEL_URL = "/models/wheel-draco.glb";

useGLTF.preload(CHASSIS_URL);
useGLTF.preload(WHEEL_URL);

// Approximate wheel positions for the chassis model
const WHEEL_POSITIONS: { pos: [number, number, number]; left: boolean }[] = [
  { pos: [-0.85, -0.42, 1.35], left: true },   // front-left
  { pos: [0.85, -0.42, 1.35], left: false },   // front-right
  { pos: [-0.85, -0.42, -1.35], left: true },  // back-left
  { pos: [0.85, -0.42, -1.35], left: false },  // back-right
];

export function RaceCarGLTF({
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
  targetFraction.current = car.fraction;

  const lateralOffset = useMemo(() => (index - 1) * 2.4, [index]);

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
    pos.y += 0.7; // lift so the GLTF wheels rest on the track surface

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
  });

  const isFinished = car.status === "finished";
  const isMoving = car.status === "racing" || car.status === "pitting";

  return (
    <group ref={groupRef}>
      {/* trail */}
      {isMoving && (
        <Trail
          width={2.0}
          length={6}
          color={car.color}
          attenuation={(t) => t * t}
          decay={3}
          local={false}
          stride={0}
          interval={1}
        >
          <mesh position={[0, 0.3, -1.6]} visible={false}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshBasicMaterial color={car.color} />
          </mesh>
        </Trail>
      )}

      <Chassis tint={car.color} dimmed={car.status === "pitting"} />
      {WHEEL_POSITIONS.map((w, i) => (
        <CarWheel key={i} position={w.pos} leftSide={w.left} />
      ))}

      {/* underglow band */}
      <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 3.3]} />
        <meshBasicMaterial
          color={car.color}
          transparent
          opacity={isMoving ? 0.22 : 0.1}
          toneMapped={false}
        />
      </mesh>

      {/* finish halo (point light only — no vertical beam) */}
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
  );
}

function Chassis({ tint, dimmed }: { tint: string; dimmed: boolean }) {
  const gltf = useGLTF(CHASSIS_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };
  const { nodes: n, materials: m } = gltf;

  // Clone the body paint material once per car instance so each can have a
  // distinct tint without mutating the shared GLTF material.
  const bodyMaterial = useMemo(() => {
    const mat = m.BodyPaint.clone();
    mat.color = new THREE.Color(tint);
    mat.metalness = 0.65;
    mat.roughness = 0.35;
    mat.emissive = new THREE.Color(tint);
    mat.emissiveIntensity = 0.18;
    return mat;
  }, [m, tint]);

  return (
    <group position={[0, -0.2, 0]} scale={0.95} dispose={null}>
      <mesh castShadow receiveShadow geometry={n.Chassis_1.geometry} material={bodyMaterial} />
      <mesh castShadow geometry={n.Chassis_2.geometry} material={n.Chassis_2.material} />
      <mesh castShadow geometry={n.Glass.geometry} material={m.Glass} material-transparent material-opacity={dimmed ? 0.3 : 0.6} />
      <mesh geometry={n.BrakeLights.geometry} material={m.BrakeLight} />
      <mesh geometry={n.HeadLights.geometry} material={m.HeadLight} />
      <mesh geometry={n.Cabin_Grilles.geometry} material={m.Black} />
      <mesh geometry={n.Undercarriage.geometry} material={m.Undercarriage} />
      <mesh geometry={n.TurnSignals.geometry} material={m.TurnSignal} />
      <mesh geometry={n.Chrome.geometry} material={n.Chrome.material} />
      <mesh geometry={n.License_1.geometry} material={m.License} />
      <mesh geometry={n.License_2.geometry} material={n.License_2.material} />
    </group>
  );
}

function CarWheel({
  position,
  leftSide,
}: {
  position: [number, number, number];
  leftSide: boolean;
}) {
  const gltf = useGLTF(WHEEL_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };
  const { nodes, materials } = gltf;
  return (
    <group position={position} dispose={null}>
      <group scale={0.95}>
        <group scale={leftSide ? -1 : 1}>
          <mesh
            castShadow
            geometry={nodes.Mesh_14.geometry}
            material={materials["Material.002"]}
          />
          <mesh
            castShadow
            geometry={nodes.Mesh_14_1.geometry}
            material={materials["Material.009"]}
          />
        </group>
      </group>
    </group>
  );
}
