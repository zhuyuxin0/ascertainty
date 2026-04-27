"use client";

import { Canvas } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import { RaceCarKenney } from "./RaceCarKenney";
import { Track } from "./Track";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { BrunoFloor } from "./BrunoFloor";
import { MOCK_GRAPHS, pickGraphForBounty } from "@/lib/mockData";
import { useRaceEngine, type CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

type RaceProps = {
  mode?: "test" | "replay";
  graphKey?: keyof typeof MOCK_GRAPHS;
  bountyId?: number;
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
        toneMappingExposure: 1.0,
      }}
      camera={{ position: [0, 6, 12], fov: 42, near: 0.1, far: 240 }}
    >
      {/* Bruno-style 4-corner gradient backdrop — drawn first, depthTest off */}
      <BrunoFloor />

      <fog attach="fog" args={["#080812", 18, 95]} />
      <ambientLight intensity={0.18} color="#7088a0" />
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
      <directionalLight position={[-10, 12, -20]} intensity={0.45} color="#00d4aa" />
      <pointLight position={[0, 10, 0]} intensity={0.4} color="#ff6b35" distance={40} decay={1.6} />

      <Suspense fallback={null}>
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

  if (onState) {
    queueMicrotask(() => onState({ cars: carEntries, track }));
  }

  return (
    <>
      <CameraRig cars={carEntries} track={track} />
      <Physics broadphase="SAP" gravity={[0, -9.81, 0]} allowSleep>
        <GroundCollider />
        <Track graph={graph} onReady={setTrack} />
        {track &&
          carEntries.map((car, i) => (
            <RaceCarKenney key={car.solver} car={car} track={track} index={i} />
          ))}
      </Physics>
    </>
  );
}

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
