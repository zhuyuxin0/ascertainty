"use client";

import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

/**
 * Three-band distant skyline: foreground props are deferred (those go on
 * the track edges via NeonArch), this component owns the midground +
 * distant rings. Buildings are dark with cyan/amber emissive accents
 * (windows). Designed to be visible through the FogExp2 — close enough
 * to read as silhouettes, far enough to suggest scale.
 */
export function CityRing({ seed = 1337 }: { seed?: number }) {
  const buildings = useMemo(() => {
    const rng = mulberry32(seed);
    const arr: { pos: [number, number, number]; size: [number, number, number]; emissive: number; emissiveColor: string }[] = [];
    const COUNT = 64;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + rng() * 0.15;
      const r = 80 + rng() * 50;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const w = 5 + rng() * 7;
      const d = 5 + rng() * 7;
      const h = 12 + Math.pow(rng(), 2) * 50;
      arr.push({
        pos: [x, h / 2, z],
        size: [w, h, d],
        emissive: rng() < 0.55 ? 0.6 + rng() * 0.7 : 0.05,
        emissiveColor: rng() < 0.7 ? "#00d4aa" : "#ff6b35",
      });
    }
    return arr;
  }, [seed]);

  const distantRing = useMemo(() => {
    const rng = mulberry32(seed + 999);
    const arr: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const COUNT = 36;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const r = 220 + rng() * 60;
      arr.push({
        pos: [Math.cos(angle) * r, 14 + rng() * 14, Math.sin(angle) * r],
        size: [10 + rng() * 8, 22 + rng() * 28, 10 + rng() * 8],
      });
    }
    return arr;
  }, [seed]);

  const cyanBldgs = buildings.filter((b) => b.emissiveColor === "#00d4aa");
  const amberBldgs = buildings.filter((b) => b.emissiveColor === "#ff6b35");

  return (
    <group>
      {/* Cyan-accent buildings (instanced) */}
      <Instances range={cyanBldgs.length} renderOrder={-1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#0a0a14"
          emissive="#00d4aa"
          emissiveIntensity={0.45}
          roughness={0.85}
          metalness={0.15}
        />
        {cyanBldgs.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.size} />
        ))}
      </Instances>

      {/* Amber-accent buildings (instanced, separate material) */}
      <Instances range={amberBldgs.length} renderOrder={-1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#0a0a14"
          emissive="#ff6b35"
          emissiveIntensity={0.4}
          roughness={0.85}
          metalness={0.15}
        />
        {amberBldgs.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.size} />
        ))}
      </Instances>

      {/* Distant ring — purely silhouette, no emissive */}
      <Instances range={distantRing.length} renderOrder={-2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#04050a" roughness={1} metalness={0} />
        {distantRing.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.size} />
        ))}
      </Instances>
    </group>
  );
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
