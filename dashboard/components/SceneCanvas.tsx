"use client";

import dynamic from "next/dynamic";

/**
 * Client-only loader for the 3D scene. Three.js needs window/document, so
 * this guard ensures Next.js never tries to SSR the canvas.
 */
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
      <span className="animate-pulse">loading scene…</span>
    </div>
  ),
});

export default function SceneCanvas({ className }: { className?: string }) {
  return (
    <div className={className ?? "w-full h-[420px] border border-line"}>
      <Scene />
    </div>
  );
}
