"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AgentPanel } from "@/components/atlas/AgentPanel";
import { ASCertaintyOverlay } from "@/components/atlas/ASCertaintyOverlay";
import { AtlasWalkthrough } from "@/components/atlas/AtlasWalkthrough";
import { BountiesPanel } from "@/components/atlas/BountiesPanel";
import Image from "next/image";
import { MinionLibrary } from "@/components/atlas/MinionLibrary";
import { MintMinionDialog } from "@/components/atlas/MintMinionDialog";
import { ModelSidePanel, MarketSidePanel } from "@/components/atlas/SidePanel";
import { PersonaDetailPanel } from "@/components/atlas/PersonaDetailPanel";
import { RegionLasso } from "@/components/atlas/RegionLasso";
import { ConnectButton } from "@/components/ConnectButton";
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

      {/* HUD: brand + breadcrumb. Wordmark + logomark is the "home"
          affordance. Breadcrumb uses ⟫ as a thin chevron for a more
          deliberate typographic feel than ›, with subtle color tiering
          (white/20 for stems, accent-tinted for the deepest segment). */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-4">
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto flex items-center gap-2.5 group"
          title="return to cosmos overview"
          aria-label="return to cosmos overview"
          style={{ viewTransitionName: "brand" }}
        >
          {/* Cardinal evening variant — lit persimmon square + bone crosshair
              + jade dot, tuned for the dusk cosmos field. Same brand mark
              that lives in the landing/claim cream chrome; the
              view-transition-name "brand" carries it across pages. */}
          <Image
            src="/logo/cardinal-evening.svg"
            alt=""
            width={28}
            height={28}
            priority
          />
          <span className="font-display text-[26px] leading-none text-cyan tracking-[0.01em] group-hover:text-glow transition-colors">
            Ascertainty
          </span>
          <span className="h-[5px] w-[5px] rounded-full bg-amber self-end mb-1" aria-hidden />
        </button>
        <span className="pointer-events-none font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 flex items-baseline gap-1.5 leading-none mt-1.5">
          <span className="text-white/35">atlas</span>
          <span className="text-white/15">⟫</span>
          <span className={bandLock ? "text-amber" : "text-cyan/75"}>
            {displayBand}
          </span>
          {bandLock && (
            <span className="text-amber font-bold ml-0.5 text-[9px]">
              ◉
            </span>
          )}
          {activeRegion && (
            <>
              <span className="text-white/15">⟫</span>
              <span
                style={{ color: `rgb(${activeRegion.color.join(",")})` }}
              >
                {activeRegion.name}
              </span>
            </>
          )}
          {selectedModel && (
            <>
              <span className="text-white/15">⟫</span>
              <span className="text-cyan">{selectedModel.name}</span>
            </>
          )}
          {selectedMarket && !selectedModel && (
            <>
              <span className="text-white/15">⟫</span>
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
        {/* Wallet — RainbowKit's connect modal. Lives in the HUD so it's
            always one click away regardless of which panel is open. */}
        <span className="ml-2"><ConnectButton /></span>
      </div>

      {/* Band-lock toggle — top center. Each band is rendered with a
          tiny indicator dot under the active band so the user has a
          stable "you are here" mark even when no band is locked. */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1 border border-line bg-bg/75 backdrop-blur px-2 py-1.5 shadow-[0_8px_32px_-8px_rgba(0,212,170,0.2)]">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40 px-2">
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
              className={`relative font-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 transition-all ${
                locked
                  ? "border border-cyan text-cyan bg-cyan/10 shadow-[0_0_12px_-2px_rgba(0,212,170,0.5)]"
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
              {b}
              {/* Tiny "you are here" indicator on the active (non-locked) band */}
              {active && !locked && (
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan/80"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Region status chip — bottom-right. A 2px accent strip on the
          left edge in the region's color ties the card to the planet
          you're looking at. Live regions get a quietly pulsing dot. */}
      {activeRegion && (
        <div
          className="absolute bottom-6 right-6 z-30 border border-line bg-bg/85 backdrop-blur pointer-events-none max-w-xs flex"
          style={{
            boxShadow: `0 16px 48px -16px rgb(${activeRegion.color.join(",")})`,
          }}
        >
          <span
            aria-hidden
            className="block w-[3px]"
            style={{ background: `rgb(${activeRegion.color.join(",")})` }}
          />
          <div className="p-3 flex-1">
            <div
              className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1 flex items-center gap-1.5"
              style={{
                color: activeRegion.status === "live" ? "#00d4aa" : "#7d8298",
              }}
            >
              {activeRegion.status === "live" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-cyan animate-ping opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
                </span>
              )}
              {activeRegion.status === "live" ? "live region" : "placeholder"}
            </div>
            <div className="font-display text-[22px] text-white leading-tight">
              {activeRegion.name}
            </div>
            <div className="font-mono text-[10px] text-white/55 mt-1 leading-relaxed">
              {activeRegion.subtitle}
            </div>
            {activeRegion.status === "placeholder" && (
              <div className="font-mono text-[10px] text-amber/70 mt-2 uppercase tracking-widest">
                {activeRegion.comingWhen}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interaction hint — bottom-left. Three tiny rows with a small
          symbol column so the eye groups by symbol instead of stripe. */}
      <div className="absolute bottom-6 left-6 z-20 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35 pointer-events-none leading-[1.6]">
        <div className="flex items-baseline gap-2">
          <span className="text-white/50">drag</span>
          <span className="text-white/20">·</span>
          <span>rotate</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white/50">⌘ / ctrl + drag</span>
          <span className="text-white/20">·</span>
          <span>pan</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white/50">scroll</span>
          <span className="text-white/20">·</span>
          <span>zoom</span>
        </div>
      </div>

      {/* Draw-region button — opens lasso for staking. Bottom-right above
          any region status chip (which has bottom-6 right-6 too); we sit
          higher so they don't collide. */}
      {!lassoActive && (
        <button
          type="button"
          onClick={() => setLassoActive(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto border border-cyan/60 bg-bg/80 backdrop-blur px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan hover:bg-cyan hover:text-bg transition-all shadow-[0_8px_32px_-8px_rgba(0,212,170,0.4)] hover:shadow-[0_8px_32px_-4px_rgba(0,212,170,0.7)]"
          title="lasso a region of nodes to stake on"
        >
          <span className="text-cyan/60 mr-2">⬚</span>draw region<span className="text-white/30 mx-2">·</span>stake
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
