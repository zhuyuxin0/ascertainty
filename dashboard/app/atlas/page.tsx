"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AgentPanel } from "@/components/atlas/AgentPanel";
import { ASCertaintyOverlay } from "@/components/atlas/ASCertaintyOverlay";
import { AtlasWalkthrough } from "@/components/atlas/AtlasWalkthrough";
import { BountiesPanel } from "@/components/atlas/BountiesPanel";
import { Logomark } from "@/components/atlas/Logomark";
import { MinionLibrary } from "@/components/atlas/MinionLibrary";
import { MintMinionDialog } from "@/components/atlas/MintMinionDialog";
import { ModelSidePanel, MarketSidePanel } from "@/components/atlas/SidePanel";
import { PersonaDetailPanel } from "@/components/atlas/PersonaDetailPanel";
import { RegionLasso } from "@/components/atlas/RegionLasso";
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
  const [lassoActive, setLassoActive] = useState(false);
  const [openPersonas, setOpenPersonas] = useState<string[]>([]);
  const addPersona = (slug: string) =>
    setOpenPersonas((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  const removePersona = (slug: string) =>
    setOpenPersonas((prev) => prev.filter((s) => s !== slug));
  const [resetNonce, setResetNonce] = useState(0);
  const [bountiesOpen, setBountiesOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const resetView = () => {
    setBandLock(null);
    setSelectedModel(null);
    setSelectedMarket(null);
    setOpenPersonas([]);
    setActiveRegion(null);
    setResetNonce((n) => n + 1);
  };

  const displayBand = bandLock ?? currentBand;

  return (
    <main className="fixed inset-0 bg-bg overflow-hidden">
      {/* Desktop-only gate. The atlas is a 3D pan-rotate-zoom interface;
          a phone tap-screen is the wrong instrument for it. */}
      <div className="md:hidden absolute inset-0 z-50 grid place-items-center bg-bg p-8">
        <div className="border border-line bg-bg/90 p-6 max-w-sm text-center">
          <p className="font-display text-3xl text-cyan mb-3">Ascertainty Atlas</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/60 mb-4">
            best on desktop
          </p>
          <p className="font-mono text-[11px] text-white/50 leading-relaxed">
            the cosmos uses rotate · pan · scroll-to-zoom on a 3D map. open this on
            a desktop browser to navigate. a flat 2D fallback is on the roadmap.
          </p>
          <Link
            href="/bounties"
            className="inline-block mt-5 font-mono text-[10px] uppercase tracking-widest border border-cyan text-cyan px-4 py-2 hover:bg-cyan hover:text-bg transition-colors"
          >
            browse bounties →
          </Link>
        </div>
      </div>

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
          onSelectPersona={addPersona}
          selectedModelId={selectedModel?.model_id ?? null}
          selectedMarketId={selectedMarket?.market_id ?? null}
          bandLock={bandLock}
          onBandChange={setCurrentBand}
          resetNonce={resetNonce}
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

      {/* HUD: brand + breadcrumb. The wordmark+logomark is the "home"
          affordance — clicking flies the camera back to the cosmos
          overview and clears any selection / band-lock. */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-3">
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto flex items-center gap-2 group"
          title="return to cosmos overview"
          aria-label="return to cosmos overview"
        >
          <Logomark size={26} />
          <span className="font-display text-2xl text-cyan tracking-wide group-hover:text-glow transition-colors">
            Ascertainty
          </span>
        </button>
        <span className="pointer-events-none font-mono text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
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

      {/* Top-right HUD: agent + bounties open as in-place slide-over
          panels so the cosmos stays alive behind. github stays as a
          real link since it leaves the app anyway. */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-4 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setAgentOpen((v) => !v);
            setBountiesOpen(false);
          }}
          className={`font-mono text-[10px] uppercase tracking-widest hover:text-cyan transition-colors ${
            agentOpen ? "text-cyan" : "text-white/50"
          }`}
        >
          agent
        </button>
        <button
          type="button"
          onClick={() => {
            setBountiesOpen((v) => !v);
            setAgentOpen(false);
          }}
          className={`font-mono text-[10px] uppercase tracking-widest hover:text-cyan transition-colors ${
            bountiesOpen ? "text-cyan" : "text-white/50"
          }`}
        >
          bounties
        </button>
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

      {/* Draw-region button — opens lasso for staking. Bottom-right above
          any region status chip (which has bottom-6 right-6 too); we sit
          higher so they don't collide. */}
      {!lassoActive && (
        <button
          type="button"
          onClick={() => setLassoActive(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto border border-cyan/60 bg-bg/80 backdrop-blur px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan hover:bg-cyan hover:text-bg transition-colors"
          title="lasso a region of nodes to stake on"
        >
          ⬚ draw region · stake
        </button>
      )}

      <RegionLasso
        active={lassoActive}
        onDeactivate={() => setLassoActive(false)}
      />

      {!overlayVisible && (
        <MinionLibrary
          refreshNonce={mintNonce}
          onMintClick={() => setMintOpen(true)}
          onSelectPersona={addPersona}
        />
      )}

      {/* Multi-persona stack — open as many as you click; staggered
          spawn position so they don't all land on top of each other.
          Each panel is independently draggable + closeable. */}
      {openPersonas.map((slug, idx) => (
        <PersonaDetailPanel
          key={slug}
          slug={slug}
          onClose={() => removePersona(slug)}
          offsetX={idx * 36}
          offsetY={idx * 36}
        />
      ))}

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

      {/* First-visit walkthrough — only shows once per browser. Fires
          after the AS-CERTAIN-TY overlay so users see the brand intro
          first, then a plain-language tour of the cosmos. */}
      {!overlayVisible && <AtlasWalkthrough />}

      {/* In-place agent + bounties panels — replace the route jumps to
          /agent and /bounties so the cosmos canvas stays alive. */}
      <BountiesPanel open={bountiesOpen} onClose={() => setBountiesOpen(false)} />
      <AgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        onSelectPersona={(slug) => {
          addPersona(slug);
          setAgentOpen(false);
        }}
      />
    </main>
  );
}
