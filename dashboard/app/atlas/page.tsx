"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { ASCertaintyOverlay } from "@/components/atlas/ASCertaintyOverlay";
import { type Region } from "@/lib/atlas/regions";

// deck.gl touches `window` on import, so the canvas is client-only.
const CosmosCanvas = dynamic(
  () =>
    import("@/components/atlas/CosmosCanvas").then((m) => ({
      default: m.CosmosCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
        <span className="animate-pulse">loading cosmos…</span>
      </div>
    ),
  },
);

export default function AtlasPage() {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);

  return (
    <main className="fixed inset-0 bg-bg overflow-hidden">
      <div className="absolute inset-0">
        <CosmosCanvas onActiveRegion={setActiveRegion} />
      </div>

      {/* HUD */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-3 pointer-events-none">
        <span className="font-display text-2xl text-cyan tracking-wide">
          Ascertainty
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          atlas · cosmos view
        </span>
      </div>

      <div className="absolute top-4 right-6 z-30 flex items-center gap-4 pointer-events-auto">
        <Link
          href="/agent"
          className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan"
        >
          agent
        </Link>
        <Link
          href="/bounties"
          className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan"
        >
          bounties
        </Link>
        <Link
          href="https://github.com/zhuyuxin0/ascertainty"
          className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan"
        >
          github
        </Link>
      </div>

      {/* Region status chip */}
      {activeRegion && (
        <div className="absolute bottom-6 right-6 z-30 border border-line bg-bg/80 backdrop-blur p-3 pointer-events-none max-w-xs">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1"
            style={{
              color: activeRegion.status === "live" ? "#00d4aa" : "#888",
            }}
          >
            {activeRegion.status === "live" ? "live region" : "placeholder"}
          </div>
          <div className="font-display text-xl text-white">
            {activeRegion.name}
          </div>
          <div className="font-mono text-[10px] text-white/50 mt-1">
            {activeRegion.subtitle}
          </div>
          {activeRegion.status === "placeholder" && (
            <div className="font-mono text-[10px] text-white/40 mt-2">
              {activeRegion.comingWhen}
            </div>
          )}
        </div>
      )}

      {overlayVisible && (
        <ASCertaintyOverlay onDismiss={() => setOverlayVisible(false)} />
      )}
    </main>
  );
}
