"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const Race = dynamic(() => import("./Race"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
      <span className="animate-pulse">spinning up race…</span>
    </div>
  ),
});

type RaceProps = ComponentProps<typeof Race>;

export default function RaceCanvas({
  className,
  ...raceProps
}: { className?: string } & RaceProps) {
  return (
    <div className={className ?? "w-full h-screen"}>
      <Race {...raceProps} />
    </div>
  );
}
