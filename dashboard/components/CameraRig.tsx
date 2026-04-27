"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

export type CameraMode = "follow" | "orbit" | "cinematic" | "overview";

const MODES: CameraMode[] = ["follow", "orbit", "cinematic", "overview"];

/**
 * Race-mode camera: tracks the lead car, but the user can press [C] to
 * cycle through modes. All modes use lerping for smooth transitions.
 */
export function CameraRig({
  cars,
  track,
  defaultMode = "follow",
}: {
  cars: CarState[];
  track: TrackGeometry | null;
  defaultMode?: CameraMode;
}) {
  const camera = useThree((s) => s.camera);
  const modeRef = useRef<CameraMode>(defaultMode);
  const tmp = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") {
        const idx = MODES.indexOf(modeRef.current);
        modeRef.current = MODES[(idx + 1) % MODES.length];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((state, delta) => {
    if (!track || cars.length === 0) {
      // No race yet — gentle orbit
      const t = state.clock.elapsedTime * 0.15;
      camera.position.set(Math.cos(t) * 24, 14, Math.sin(t) * 24);
      camera.lookAt(0, 1, 0);
      return;
    }

    const lead = cars.reduce((a, b) => (a.fraction > b.fraction ? a : b));
    const f = THREE.MathUtils.clamp(lead.fraction, 0, 0.999);
    const idx = f * (track.centerlinePoints.length - 1);
    const i = Math.floor(idx);
    const a = track.centerlinePoints[i];
    const b = track.centerlinePoints[Math.min(i + 1, track.centerlinePoints.length - 1)];
    target.current.copy(a).lerp(b, idx - i);
    target.current.y += 0.5;

    const heading = b.clone().sub(a).normalize();

    switch (modeRef.current) {
      case "follow": {
        // chase cam: behind + above the lead
        tmp.current
          .copy(target.current)
          .addScaledVector(heading, -8)
          .add(new THREE.Vector3(0, 4.5, 0));
        camera.position.lerp(tmp.current, Math.min(1, delta * 3));
        camera.lookAt(target.current);
        break;
      }
      case "orbit": {
        const t = state.clock.elapsedTime * 0.2;
        tmp.current.copy(target.current).add(
          new THREE.Vector3(Math.cos(t) * 14, 8, Math.sin(t) * 14),
        );
        camera.position.lerp(tmp.current, Math.min(1, delta * 2));
        camera.lookAt(target.current);
        break;
      }
      case "cinematic": {
        // low-angle dramatic shot from the side
        const side = new THREE.Vector3(0, 1, 0).cross(heading).normalize();
        tmp.current
          .copy(target.current)
          .addScaledVector(side, 10)
          .addScaledVector(heading, -2)
          .add(new THREE.Vector3(0, 1.6, 0));
        camera.position.lerp(tmp.current, Math.min(1, delta * 2));
        camera.lookAt(target.current);
        break;
      }
      case "overview": {
        // bird's-eye over the whole track
        const center = new THREE.Vector3();
        for (const p of track.centerlinePoints) center.add(p);
        center.divideScalar(track.centerlinePoints.length);
        tmp.current.copy(center).add(new THREE.Vector3(0, 38, 0));
        camera.position.lerp(tmp.current, Math.min(1, delta * 1.5));
        camera.lookAt(center);
        break;
      }
    }
  });

  return null;
}
