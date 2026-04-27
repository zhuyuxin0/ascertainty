"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Grid } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

/**
 * Base scene foundation — dark backdrop, subtle lighting, grid floor,
 * particle starfield. The race-specific track + vehicles compose into
 * this in later sub-tasks.
 */
export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [10, 8, 14], fov: 45, near: 0.1, far: 200 }}
      style={{ background: "#050507" }}
    >
      <fog attach="fog" args={["#050507", 18, 70]} />
      <ambientLight intensity={0.18} color="#7088a0" />
      <directionalLight
        position={[10, 16, 8]}
        intensity={0.7}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <spotLight
        position={[-12, 10, -6]}
        intensity={0.6}
        angle={0.6}
        penumbra={0.8}
        color="#00d4aa"
      />
      <Suspense fallback={null}>
        <Stars
          radius={80}
          depth={50}
          count={2000}
          factor={2.5}
          fade
          saturation={0}
          speed={0.4}
        />
        <Grid
          args={[60, 60]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#1a1a22"
          sectionSize={6}
          sectionThickness={1}
          sectionColor="#00d4aa"
          fadeDistance={50}
          fadeStrength={1.5}
          followCamera={false}
          infiniteGrid
        />
        <PlaceholderCube />
      </Suspense>
    </Canvas>
  );
}

function PlaceholderCube() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.4;
    ref.current.rotation.y += delta * 0.6;
  });
  return (
    <mesh ref={ref} position={[0, 1.2, 0]} castShadow>
      <boxGeometry args={[1.4, 1.4, 1.4]} />
      <meshStandardMaterial
        color="#0a0a10"
        emissive="#00d4aa"
        emissiveIntensity={0.6}
        metalness={0.6}
        roughness={0.3}
      />
    </mesh>
  );
}
