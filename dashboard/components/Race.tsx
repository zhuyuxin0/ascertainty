"use client";

import { Canvas } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Stars } from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import { Track } from "./Track";
import { MOCK_GRAPHS } from "@/lib/mockData";
import type { TrackGeometry } from "@/lib/trackMapping";

/**
 * Race scene: Physics provider + procedural track + at least one
 * controllable vehicle spawned at the track start. Multiple cars +
 * camera rig + HUD compose into this in later sub-tasks.
 */
export default function Race({ graphKey = "sort" }: { graphKey?: keyof typeof MOCK_GRAPHS }) {
  const [track, setTrack] = useState<TrackGeometry | null>(null);
  const graph = MOCK_GRAPHS[graphKey] ?? MOCK_GRAPHS.sort;
  const spawn: [number, number, number] = track
    ? [track.spawnPoint.x, track.spawnPoint.y + 1.4, track.spawnPoint.z]
    : [0, 1.4, 0];
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
        <Physics
          broadphase="SAP"
          gravity={[0, -9.81, 0]}
          allowSleep={false}
          defaultContactMaterial={{ friction: 0.5, restitution: 0.05 }}
        >
          <Ground />
          <Track graph={graph} onReady={setTrack} />
          {track && <Vehicle key={graphKey} position={spawn} color="#00d4aa" />}
        </Physics>
      </Suspense>
    </Canvas>
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
