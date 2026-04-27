"use client";

import { Leva } from "leva";
// r3f-perf must be inside <Canvas>; for now just provide leva.
// (Hooking <Perf> directly into Race.tsx in a future polish pass.)

export function DebugOverlay() {
  return (
    <>
      <Leva collapsed={false} oneLineLabels />
    </>
  );
}
