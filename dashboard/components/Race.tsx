"use client";

import { Canvas } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Stars, Sparkles, Environment } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import { RaceCarGLTF } from "./RaceCarGLTF";
import { Track } from "./Track";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { Skyline } from "./Skyline";
import { MOCK_GRAPHS, pickGraphForBounty } from "@/lib/mockData";
import { useRaceEngine, type CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

type RaceProps = {
  /** "test" — single physics-controllable car (WASD).
   *  "replay" — kinematic cars driven by /bounty/{id}/race-events polling. */
  mode?: "test" | "replay";
  graphKey?: keyof typeof MOCK_GRAPHS;
  bountyId?: number;
  /** Replay mode: lift cars + track refs out so the parent page can render
   *  HTML overlays (HUD) using the same data. */
  onState?: (state: { cars: CarState[]; track: TrackGeometry | null }) => void;
};

export default function Race({ mode = "test", graphKey, bountyId, onState }: RaceProps) {
  const graph = useMemo(() => {
    if (mode === "replay" && bountyId !== undefined) return pickGraphForBounty(bountyId);
    if (graphKey) return MOCK_GRAPHS[graphKey];
    return MOCK_GRAPHS.sort;
  }, [mode, graphKey, bountyId]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{ position: [0, 6, 12], fov: 42, near: 0.1, far: 240 }}
      style={{ background: "#050507" }}
    >
      <color attach="background" args={["#06070d"]} />
      <fog attach="fog" args={["#0a0e18", 18, 95]} />

      {/* low ambient — let directional + rim do the work */}
      <ambientLight intensity={0.12} color="#5b6b80" />

      {/* key light — low angle, warm-cold split */}
      <directionalLight
        position={[16, 24, 10]}
        intensity={0.85}
        color="#cfd8e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />

      {/* cyan rim from behind — silhouettes pop */}
      <directionalLight position={[-10, 12, -20]} intensity={0.45} color="#00d4aa" />

      {/* amber accent — warm punctuation */}
      <pointLight position={[0, 10, 0]} intensity={0.4} color="#ff6b35" distance={40} decay={1.6} />

      <Suspense fallback={null}>
        <Stars
          radius={140}
          depth={80}
          count={1800}
          factor={2.5}
          fade
          saturation={0}
          speed={0.25}
        />
        <Skyline count={42} innerRadius={70} outerRadius={105} />
        {/* atmospheric volumetric particles drifting through scene */}
        <Sparkles
          count={140}
          scale={[100, 20, 100]}
          size={2.4}
          speed={0.3}
          opacity={0.6}
          color="#00d4aa"
          noise={0.25}
        />
        {mode === "test" ? (
          <TestSceneContents graph={graph} />
        ) : (
          <ReplaySceneContents graph={graph} bountyId={bountyId!} onState={onState} />
        )}
      </Suspense>
      <PostFX />
    </Canvas>
  );
}

function TestSceneContents({ graph }: { graph: ReturnType<typeof pickGraphForBounty> }) {
  const [track, setTrack] = useState<TrackGeometry | null>(null);
  const spawn: [number, number, number] = track
    ? [track.spawnPoint.x, track.spawnPoint.y + 1.4, track.spawnPoint.z]
    : [0, 1.4, 0];
  return (
    <Physics
      broadphase="SAP"
      gravity={[0, -9.81, 0]}
      allowSleep={false}
      defaultContactMaterial={{ friction: 0.5, restitution: 0.05 }}
    >
      <GroundCollider />
      <DarkFloor />
      <Track graph={graph} onReady={setTrack} />
      {track && <Vehicle position={spawn} color="#00d4aa" />}
    </Physics>
  );
}

function ReplaySceneContents({
  graph,
  bountyId,
  onState,
}: {
  graph: ReturnType<typeof pickGraphForBounty>;
  bountyId: number;
  onState?: (state: { cars: CarState[]; track: TrackGeometry | null }) => void;
}) {
  const [track, setTrack] = useState<TrackGeometry | null>(null);
  const { cars } = useRaceEngine(bountyId);
  const carEntries = Object.values(cars);

  // Bubble state up so parent can render the HUD with the same data
  if (onState) {
    // Effects must not run during render; we use a microtask
    queueMicrotask(() => onState({ cars: carEntries, track }));
  }

  return (
    <>
      <CameraRig cars={carEntries} track={track} />
      <Physics broadphase="SAP" gravity={[0, -9.81, 0]} allowSleep>
        <GroundCollider />
        <DarkFloor />
        <Track graph={graph} onReady={setTrack} />
        {track &&
          carEntries.map((car, i) => (
            <RaceCarGLTF key={car.solver} car={car} track={track} index={i} />
          ))}
      </Physics>
    </>
  );
}

/** Invisible physics floor — keeps RaycastVehicle suspension from
 *  punching through if the trimesh road has gaps. Visual is handled
 *  separately by `DarkFloor` so we can fade it into the fog. */
function GroundCollider() {
  const [ref] = usePlane(
    () => ({
      rotation: [-Math.PI / 2, 0, 0],
      type: "Static",
      material: { friction: 0.4 },
    }),
    useRef<THREE.Object3D>(null),
  );
  return <mesh ref={ref as React.Ref<THREE.Mesh>} visible={false} />;
}

/** Visual-only floor that catches shadows + dissolves into fog. No
 *  hard "edge" of the world that breaks immersion. */
function DarkFloor() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <circleGeometry args={[110, 80]} />
      <meshStandardMaterial color="#06060a" roughness={1} metalness={0} />
    </mesh>
  );
}
