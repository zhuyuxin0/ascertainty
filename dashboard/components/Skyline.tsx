"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Distant low-poly skyline silhouettes ringing the play area. They sit
 * far enough back to be mostly obscured by fog, but close enough that
 * the eye reads them as "city in the distance" rather than void. Gives
 * the scene a horizon and breaks the pure-black backdrop.
 */
export function Skyline({
  count = 38,
  innerRadius = 70,
  outerRadius = 110,
  seed = 0,
}: {
  count?: number;
  innerRadius?: number;
  outerRadius?: number;
  seed?: number;
}) {
  const blocks = useMemo(() => {
    const rng = mulberry32(seed || 1337);
    const arr: { pos: [number, number, number]; size: [number, number, number]; emissive: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.3;
      const r = innerRadius + rng() * (outerRadius - innerRadius);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const w = 4 + rng() * 6;
      const d = 4 + rng() * 6;
      const h = 6 + rng() * 24;
      arr.push({
        pos: [x, h / 2, z],
        size: [w, h, d],
        emissive: rng() < 0.4 ? 0.35 : 0.05,
      });
    }
    return arr;
  }, [count, innerRadius, outerRadius, seed]);

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color="#0a0a14"
            emissive="#00d4aa"
            emissiveIntensity={b.emissive}
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      ))}
      {/* horizon haze ring — thin glowing band at distance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[outerRadius - 8, outerRadius - 4, 96]} />
        <meshBasicMaterial color="#00d4aa" transparent opacity={0.04} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Deterministic PRNG so the skyline is stable across re-renders
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
