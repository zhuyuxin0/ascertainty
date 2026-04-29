"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { ASCertaintyOverlay } from "@/components/atlas/ASCertaintyOverlay";
import { MinionLibrary } from "@/components/atlas/MinionLibrary";
import { MintMinionDialog } from "@/components/atlas/MintMinionDialog";
import { ModelSidePanel, MarketSidePanel } from "@/components/atlas/SidePanel";
import { type Region } from "@/lib/atlas/regions";
import { type AtlasModel, type AtlasMarket } from "@/lib/atlas/types";
import { type ZoomBand } from "@/lib/atlas/zoomLevels";

// r3f Canvas needs window/document, so the 3D cosmos is client-only.
const CosmosScene = dynamic(
  () =>
    import("@/components/atlas/CosmosScene").then((m) => ({
      default: m.CosmosScene,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
        <span className="animate-pulse">spinning up cosmos…</span>
      </div>
    ),
  },
);

export default function AtlasPage() {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [selectedModel, setSelectedModel] = useState<AtlasModel | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<AtlasMarket | null>(null);
  const [bandLock, setBandLock] = useState<ZoomBand | null>(null);
  const [currentBand, setCurrentBand] = useState<ZoomBand>("cosmos");
  const [mintOpen, setMintOpen] = useState(false);
  const [mintNonce, setMintNonce] = useState(0);

  const displayBand = bandLock ?? currentBand;

  return (
    <main className="fixed inset-0 bg-bg overflow-hidden">
      <div className="absolute inset-0">
        <CosmosScene
          onActiveRegion={setActiveRegion}
          onSelectModel={(m) => {
            setSelectedModel(m);
            if (m) setSelectedMarket(null);
          }}
          onSelectMarket={(m) => {
            setSelectedMarket(m);
            if (m) setSelectedModel(null);
          }}
          bandLock={bandLock}
          onBandChange={setCurrentBand}
        />
      </div>

      <ModelSidePanel
        model={selectedModel}
        onClose={() => setSelectedModel(null)}
      />
      <MarketSidePanel
        market={selectedMarket}
        onClose={() => setSelectedMarket(null)}
      />

      {/* HUD: brand + breadcrumb */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-3 pointer-events-none">
        <span className="font-display text-2xl text-cyan tracking-wide">
          Ascertainty
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
          <span>atlas</span>
          <span className="text-white/20">›</span>
          <span className={bandLock ? "text-amber" : "text-cyan/70"}>
            {displayBand}
          </span>
          {bandLock && (
            <span className="text-amber font-bold ml-1">🔒</span>
          )}
          {activeRegion && (
            <>
              <span className="text-white/20">›</span>
              <span style={{ color: `rgb(${activeRegion.color.join(",")})` }}>
                {activeRegion.name}
              </span>
            </>
          )}
          {selectedModel && (
            <>
              <span className="text-white/20">›</span>
              <span className="text-cyan">{selectedModel.name}</span>
            </>
          )}
          {selectedMarket && !selectedModel && (
            <>
              <span className="text-white/20">›</span>
              <span className="text-amber">
                {selectedMarket.question.slice(0, 30)}
                {selectedMarket.question.length > 30 ? "…" : ""}
              </span>
            </>
          )}
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

      {/* Band-lock toggle: top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 border border-line bg-bg/70 backdrop-blur px-2 py-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 px-2">
          band
        </span>
        {(["cosmos", "domain", "entity", "detail"] as const).map((b) => {
          const active = displayBand === b;
          const locked = bandLock === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBandLock(locked ? null : b)}
              className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 transition-colors ${
                locked
                  ? "border border-cyan text-cyan bg-cyan/10"
                  : active
                    ? "text-cyan/80 hover:text-cyan"
                    : "text-white/40 hover:text-white/70"
              }`}
              title={
                locked
                  ? `unlock ${b}`
                  : `lock to ${b} (camera can pan freely without changing band)`
              }
            >
              {locked ? "🔒 " : ""}
              {b}
            </button>
          );
        })}
      </div>

      {/* Region status chip — bottom-right */}
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

      {/* Interaction hint — bottom-left */}
      <div className="absolute bottom-6 left-6 z-20 font-mono text-[9px] uppercase tracking-widest text-white/30 pointer-events-none leading-relaxed">
        <div>drag · rotate</div>
        <div>⌘ / ctrl + drag · pan</div>
        <div>scroll · zoom</div>
      </div>

      {!overlayVisible && (
        <MinionLibrary
          refreshNonce={mintNonce}
          onMintClick={() => setMintOpen(true)}
        />
      )}

      <MintMinionDialog
        open={mintOpen}
        onClose={() => {
          setMintOpen(false);
          setMintNonce((n) => n + 1);
        }}
      />

      {overlayVisible && (
        <ASCertaintyOverlay onDismiss={() => setOverlayVisible(false)} />
      )}
    </main>
  );
}
