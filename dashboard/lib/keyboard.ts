"use client";

import { useEffect, useRef } from "react";

export type Controls = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
};

const KEY_MAP: Record<string, keyof Controls> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "brake",
};

/**
 * Subscribe to WASD/arrow keys; returns a *ref* (not state) so updates
 * don't re-render every frame. Read inside useFrame.
 */
export function useKeyboardControls() {
  const controls = useRef<Controls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) {
        controls.current[key] = true;
        if (e.code === "Space") e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) controls.current[key] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return controls;
}
