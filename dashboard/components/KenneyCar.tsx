"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Kenney Car Kit (CC0). 3 hand-picked low-poly silhouettes.
 *
 * Kenney models bake palette colors into vertex attributes, so material
 * `color` tints don't work directly — vertex colors dominate. We brute-
 * force replace every mesh's material with a fresh MeshStandardMaterial
 * tinted to the solver's color, with mesh-name heuristics distinguishing
 * wheels (dark), glass/lights (emissive), and body (tinted).
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

  const cloned = useMemo(() => {
    const root = scene.clone(true);
    const tintColor = new THREE.Color(tint);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: "#0a0a0e",
      roughness: 0.7,
      metalness: 0.4,
      vertexColors: false,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: "#04101a",
      roughness: 0.05,
      metalness: 0.95,
      vertexColors: false,
    });
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      toneMapped: false,
    });
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: tintColor,
      metalness: 0.55,
      roughness: 0.38,
      emissive: tintColor,
      emissiveIntensity: dimmed ? 0.04 : 0.22,
      vertexColors: false,
    });

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const meshName = (obj.name || "").toLowerCase();
      const matName = (
        Array.isArray(obj.material)
          ? obj.material[0]?.name || ""
          : (obj.material as THREE.Material)?.name || ""
      ).toLowerCase();
      const both = `${meshName} ${matName}`;

      let chosen: THREE.Material;
      if (both.includes("wheel") || both.includes("tire") || both.includes("rim")) {
        chosen = wheelMaterial;
      } else if (both.includes("glass") || both.includes("window") || both.includes("windshield")) {
        chosen = glassMaterial;
      } else if (both.includes("light") || both.includes("lamp") || both.includes("headlight")) {
        chosen = lightMaterial;
      } else {
        chosen = bodyMaterial;
      }

      obj.material = chosen;
      obj.castShadow = true;
      obj.receiveShadow = false;
    });

    return root;
  }, [scene, tint, dimmed]);

  return <primitive object={cloned} />;
}
