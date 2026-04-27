"use client";

import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

/**
 * Distant horizon as a forest of vertical light columns rather than
 * cube buildings. Each column is a thin tall emissive rectangle —
 * reads as "city skyline of glowing windows" rather than a low-poly
 * model. Fog hides most of the geometry; only the glow remains.
 *
 * No shadows, no lighting contribution — purely emissive. The bloom
 * pass picks up the columns as luminous pillars.
 */
export function CityRing({ seed = 1337 }: { seed?: number }) {
  const cyanCols = useMemo(() => buildColumns(seed, "#00d4aa"), [seed]);
  const amberCols = useMemo(() => buildColumns(seed + 7, "#ff6b35"), [seed]);
  const purpleCols = useMemo(() => buildColumns(seed + 13, "#8b5cf6"), [seed]);

  return (
    <group>
      <ColumnInstances cols={cyanCols} color="#00d4aa" />
      <ColumnInstances cols={amberCols} color="#ff6b35" />
      <ColumnInstances cols={purpleCols} color="#8b5cf6" />
    </group>
  );
}

type Col = { pos: [number, number, number]; height: number; width: number };

function buildColumns(seed: number, _color: string): Col[] {
  const rng = mulberry32(seed);
  const arr: Col[] = [];
  const COUNT = 28;
  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2 + rng() * 0.18;
    const r = 90 + rng() * 70;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const height = 18 + Math.pow(rng(), 1.6) * 60;
    const width = 0.6 + rng() * 1.2;
    arr.push({ pos: [x, height / 2, z], height, width });
  }
  return arr;
}

function ColumnInstances({ cols, color }: { cols: Col[]; color: string }) {
  return (
    <Instances range={cols.length} renderOrder={-1}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.55} />
      {cols.map((c, i) => (
        <Instance key={i} position={c.pos} scale={[c.width, c.height, c.width]} />
      ))}
    </Instances>
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
