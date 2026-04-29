"use client";

import * as THREE from "three";

/**
 * Module-singleton registry that bridges the in-Canvas world (camera +
 * entity 3D positions) with HTML overlays sitting outside the Canvas
 * (region lasso, hover panels). The Canvas writes; the overlays read.
 *
 * Why a singleton: there is exactly one CosmosScene + one RegionLasso
 * pair on the atlas page. Threading refs through CosmosScene → Three.js
 * Canvas → HTML cousins is awkward, and React context across the
 * Canvas/HTML boundary doesn't reliably propagate. A single shared
 * record is the pragmatic fit.
 *
 * Reads happen on user-action (lasso commit, etc.), so even though the
 * registry mutates each frame, no React re-renders depend on it.
 */

export type EntityKind = "model" | "market" | "bounty";

export type EntityRecord = {
  id: string;
  kind: EntityKind;
  position: [number, number, number]; // 3D world position
  /** Aggregate quality-ish score (0-100ish). Models: their .aggregate.
   *  Markets: |prob-0.5|*200. Bounties: difficulty*10. */
  score: number;
  /** For consensus aggregation: +1 = "long" / certain, -1 = "short" /
   *  uncertain, 0 = neutral. Models: +1 if score > 70 else 0. Markets:
   *  +1 if prob > 0.5 else -1. Bounties: 0 (neutral). */
  direction: number;
  /** Original payload so the consumer can pull out anything else. */
  data: unknown;
};

type Registry = {
  entities: EntityRecord[];
  camera: THREE.Camera | null;
  /** Pixel size of the canvas viewport (devicePixelRatio not applied
   *  — these are CSS pixels matching `clientX/clientY` from the lasso). */
  viewport: { width: number; height: number };
};

export const registry: Registry = {
  entities: [],
  camera: null,
  viewport: { width: 0, height: 0 },
};

/** Project a world-space point to screen-space CSS pixels. Returns null
 *  when the point is behind the camera or outside the clip volume. */
export function projectToScreen(
  p: [number, number, number],
): [number, number] | null {
  if (!registry.camera || !registry.viewport.width) return null;
  const v = new THREE.Vector3(p[0], p[1], p[2]);
  v.project(registry.camera);
  // .project produces NDC in [-1, 1]; z outside [-1, 1] is clipped.
  if (v.z > 1 || v.z < -1) return null;
  const x = (v.x + 1) * 0.5 * registry.viewport.width;
  const y = (-v.y + 1) * 0.5 * registry.viewport.height;
  return [x, y];
}

/** Push a fresh entity list. Called by CosmosScene after layout settles. */
export function setEntities(entities: EntityRecord[]) {
  registry.entities = entities;
}

/** Push fresh camera + viewport. Called every frame by CosmosScene. */
export function setCameraAndViewport(
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  registry.camera = camera;
  registry.viewport.width = width;
  registry.viewport.height = height;
}
