"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Kenney Car Kit (CC0). 3 hand-picked low-poly silhouettes:
 *   0 → race-future.glb (futuristic, cyberpunk-friendly silhouette)
 *   1 → race.glb (classic open-wheel racer)
 *   2 → sedan-sports.glb (grounded sporty body)
 *
 * Per-instance body tint via material clone; emissive headlights/tail
 * glow keyed off the solver color so bloom catches them.
 */

const CAR_URLS = [
  "/models/cars/race-future.glb",
  "/models/cars/race.glb",
  "/models/cars/sedan-sports.glb",
];

CAR_URLS.forEach((u) => useGLTF.preload(u));

export function KenneyCar({
  modelIndex,
  tint,
  dimmed = false,
}: {
  modelIndex: number;
  tint: string;
  dimmed?: boolean;
}) {
  const url = CAR_URLS[modelIndex % CAR_URLS.length];
  const { scene } = useGLTF(url) as unknown as { scene: THREE.Group };

  // Clone scene per instance so material tweaks don't leak across cars
  const cloned = useMemo(() => {
    const root = scene.clone(true);
    const tintColor = new THREE.Color(tint);
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.color) return;
      const matName = (mat.name || "").toLowerCase();
      const colorHex = `#${mat.color.getHexString()}`;

      // Heuristic: Kenney cars use a few named/colored materials.
      // Tint anything that's the dominant body color (not pure black/white/grey).
      const r = mat.color.r, g = mat.color.g, b = mat.color.b;
      const isGray = Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05;
      const isVeryDark = r + g + b < 0.4;
      const isVeryLight = r + g + b > 2.6;

      // Identify likely body panel
      if (!isGray && !isVeryDark && !isVeryLight && colorHex !== "#ffffff") {
        const cloned = mat.clone();
        cloned.color = tintColor.clone();
        cloned.metalness = 0.55;
        cloned.roughness = 0.4;
        cloned.emissive = tintColor.clone();
        cloned.emissiveIntensity = dimmed ? 0.05 : 0.18;
        obj.material = cloned;
      } else if (matName.includes("light") || matName.includes("glass")) {
        // Headlights / glass — emissive cyan-white
        const cloned = mat.clone();
        cloned.emissive = new THREE.Color("#ffffff");
        cloned.emissiveIntensity = 1.6;
        obj.material = cloned;
      }
      obj.castShadow = true;
      obj.receiveShadow = false;
    });
    return root;
  }, [scene, tint, dimmed]);

  return <primitive object={cloned} />;
}
