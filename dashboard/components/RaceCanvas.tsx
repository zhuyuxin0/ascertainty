"use client";

import dynamic from "next/dynamic";

const Race = dynamic(() => import("./Race"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
      <span className="animate-pulse">spinning up race…</span>
    </div>
  ),
});

export default function RaceCanvas({ className }: { className?: string }) {
  return (
    <div className={className ?? "w-full h-screen"}>
      <Race />
    </div>
  );
}
