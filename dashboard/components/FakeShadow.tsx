"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Per-object fake shadow plane. Ported from
 * brunosimon/folio-2019/src/javascript/World/Shadows.js, simplified.
 *
 * Bruno's quote: "There are no lights, nor shadows in the scene. It's
 * just illusions." We render a soft radial-gradient texture on a small
 * plane just above the floor, sized to the car's footprint. Cheaper
 * than ContactShadows and more art-directed.
 *
 * Caller supplies position + color tint. The shadow follows the car.
 */

const SHADOW_SIZE = 3.2;
const TEX_SIZE = 128;

let cachedTexture: THREE.CanvasTexture | null = null;

function getShadowTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  // Radial gradient — tighter falloff in the center for car-shaped shadow
  const grad = ctx.createRadialGradient(
    TEX_SIZE / 2, TEX_SIZE / 2, 4,
    TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE / 2 - 4,
  );
  grad.addColorStop(0, "rgba(0,0,0,0.85)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.75, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  cachedTexture = new THREE.CanvasTexture(canvas);
  cachedTexture.colorSpace = THREE.SRGBColorSpace;
  return cachedTexture;
}

export function FakeShadow({
  position,
  rotation = 0,
  alpha = 1,
  size = SHADOW_SIZE,
}: {
  position: [number, number, number];
  rotation?: number;
  alpha?: number;
  size?: number;
}) {
  const tex = useMemo(() => getShadowTexture(), []);
  return (
    <mesh
      position={[position[0], position[1] + 0.02, position[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      renderOrder={-10}
    >
      <planeGeometry args={[size, size * 1.2]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={alpha}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
