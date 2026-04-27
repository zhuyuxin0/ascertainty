"use client";

import { Canvas } from "@react-three/fiber";
import { Physics, usePlane } from "@react-three/cannon";
import { Stars, Grid } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";

import { Vehicle } from "./Vehicle";

/**
 * Race scene foundation: Physics provider + ground plane + at least one
 * controllable vehicle. Track + multiple cars + camera rig + HUD compose
 * into this in later sub-tasks.
 */
export default function Race() {
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
          <Grid
            args={[80, 80]}
            position={[0, 0.005, 0]}
            cellSize={1}
            cellThickness={0.3}
            cellColor="#15151c"
            sectionSize={6}
            sectionThickness={0.8}
            sectionColor="#00d4aa"
            fadeDistance={60}
            fadeStrength={1.2}
            followCamera={false}
            infiniteGrid
          />
          <Vehicle position={[0, 1.4, 0]} color="#00d4aa" />
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
