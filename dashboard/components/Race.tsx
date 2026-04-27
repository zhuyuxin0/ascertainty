"use client";

import { Canvas } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Stars } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import { RaceCar } from "./RaceCar";
import { Track } from "./Track";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
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
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 14, 18], fov: 45, near: 0.1, far: 200 }}
      style={{ background: "#050507" }}
    >
      <fog attach="fog" args={["#050507", 30, 100]} />
      <ambientLight intensity={0.2} color="#7088a0" />
      <directionalLight
        position={[20, 30, 12]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <spotLight
        position={[-20, 18, -10]}
        intensity={0.6}
        angle={0.7}
        penumbra={0.8}
        color="#00d4aa"
      />
      <Suspense fallback={null}>
        <Stars
          radius={120}
          depth={70}
          count={2500}
          factor={3}
          fade
          saturation={0}
          speed={0.3}
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
      <Ground />
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
        <Ground />
        <Track graph={graph} onReady={setTrack} />
        {track &&
          carEntries.map((car, i) => (
            <RaceCar key={car.solver} car={car} track={track} index={i} />
          ))}
      </Physics>
    </>
  );
}

function Ground() {
  const [ref] = usePlane(
    () => ({
      rotation: [-Math.PI / 2, 0, 0],
      type: "Static",
      material: { friction: 0.6 },
    }),
    useRef<THREE.Object3D>(null),
  );
  return (
    <mesh ref={ref as React.Ref<THREE.Mesh>} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#0a0a10" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}
