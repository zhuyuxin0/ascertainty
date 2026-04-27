"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import { RaceCarKenney } from "./RaceCarKenney";
import { Track } from "./Track";
import { CameraRig } from "./CameraRig";
import { PostFX } from "./PostFX";
import { BrunoFloor } from "./BrunoFloor";
import { CityRing } from "./CityRing";
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

      {/* Exponential fog matched to background within ~5% luminance — Bruno
          calls this out as the single biggest "looks generated" tell. */}
      <ExpFog color="#0a0e16" density={0.012} />

      {/* Cool key (sky) — provides actual shadow casting */}
      <directionalLight
        position={[16, 24, 10]}
        intensity={1.1}
        color="#9fdfff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />
      {/* Cyan rim from behind — silhouettes pop against fog */}
      <directionalLight position={[-12, 8, -22]} intensity={0.55} color="#00d4aa" />
      {/* Amber accent — warm punctuation overhead */}
      <pointLight position={[0, 14, 0]} intensity={0.35} color="#ff6b35" distance={45} decay={1.6} />

      <Suspense fallback={null}>
        {/* IBL: provides body-paint reflections without contributing fill */}
        <Environment
          files="/hdri/rooftop_night_2k.exr"
          environmentIntensity={0.35}
          background={false}
        >
          {/* Fake highway-billboard rect lights, only visible in car reflections */}
          <Lightformer form="rect" intensity={3} color="#00d4aa" position={[10, 4, -5]} scale={[8, 1.5, 1]} />
          <Lightformer form="rect" intensity={3} color="#ff6b35" position={[-10, 3, -8]} scale={[6, 1.2, 1]} />
          <Lightformer form="rect" intensity={2.5} color="#ffffff" position={[0, 6, -20]} scale={[14, 0.8, 1]} />
          <Lightformer form="rect" intensity={2} color="#a855f7" position={[12, 5, 8]} scale={[5, 1, 1]} />
        </Environment>

        {/* Distant cyberpunk skyline silhouettes — three bands of depth */}
        <CityRing seed={mode === "replay" ? (bountyId ?? 1) * 17 : 1337} />

        {/* Sky-wide drifting particles at car-eye-level for atmospheric depth */}
        <Sparkles
          count={180}
          scale={[120, 24, 120]}
          size={3.5}
          speed={0.4}
          opacity={0.9}
          color="#00d4aa"
          noise={0.4}
          position={[0, 4, 0]}
        />
        <Sparkles
          count={80}
          scale={[80, 12, 80]}
          size={2.0}
          speed={0.3}
          opacity={0.7}
          color="#ff6b35"
          noise={0.3}
          position={[0, 2, 0]}
        />

        {/* Bright sun anchor for the lens flare — large + intense so it
            actually triggers the ektogamat effect's screen-space sampling */}
        <mesh position={[-45, 28, -55]}>
          <sphereGeometry args={[5, 24, 24]} />
          <meshBasicMaterial color="#fff8dc" toneMapped={false} />
        </mesh>
        <pointLight position={[-45, 28, -55]} intensity={2.5} color="#fff8dc" distance={120} decay={1.6} />

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

/** Replace linear `<fog>` with exponential — matches the cyberpunk
 *  brief's "infinite gradient void" feel rather than a hard wall. */
function ExpFog({ color, density }: { color: string; density: number }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.FogExp2(color, density);
    return () => {
      scene.fog = prev;
    };
  }, [scene, color, density]);
  return null;
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
