"use client";
/* HUD — the floating chrome layer of the v3 atlas.
 *
 * All elements are absolutely-positioned; the parent <div> has
 * `pointer-events: none` so the SVG cosmos behind stays interactive,
 * and each chrome child reasserts `pointer-events: auto`.
 *
 * Zone map (matches design_handoff_atlas_v3 README § HUD chrome):
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ brand (TL)                          nav · wallet (TR)│
 *   │ breadcrumb (TL, below brand)        minimap (TR-)    │
 *   │                  band-lock (TC)     scale-chip (TR-) │
 *   │                                     now-observing (R)│
 *   │                                                      │
 *   │                  watermark "atlas"                   │
 *   │                                                      │
 *   │ keymap-hints (BL)                                    │
 *   │ compass (BL)        draw-region (BC)   region-status │
 *   │                     volume-strip (BC)                │
 *   └──────────────────────────────────────────────────────┘
 *
 * The demo bar (bottom dev-only buttons) is gated behind
 * NODE_ENV !== 'production'. */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useAtlasV3, type Band } from "@/lib/atlas-v3/state";
import { REGIONS } from "@/lib/atlas-v3/regions";

const EXPLORER = "https://chainscan-galileo.0g.ai";

type LiveStats = {
  liveBounties: number;
  weeklyPaidUsd: number;
  modelCount: number;
  marketCount: number;
};

export function HUD({ stats }: { stats: LiveStats }) {
  // chrome subscribes only to slices it needs
  const band = useAtlasV3((s) => s.band);
  const region = useAtlasV3((s) => s.region);
  const setBand = useAtlasV3((s) => s.setBand);
  const togglePanel = useAtlasV3((s) => s.togglePanel);
  const reset = useAtlasV3((s) => s.reset);
  const setLasso = useAtlasV3((s) => s.setLasso);
  const setHelp = useAtlasV3((s) => s.setHelp);
  const setLibrary = useAtlasV3((s) => s.setLibrary);
  const setWalletMenu = useAtlasV3((s) => s.setWalletMenu);
  const walletMenu = useAtlasV3((s) => s.walletMenu);
  const pushToast = useAtlasV3((s) => s.pushToast);
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);
  const observe = useAtlasV3((s) => s.observe);
  const scale = useAtlasV3((s) => s.scale);
  const setScale = useAtlasV3((s) => s.setScale);
  const viewport = useAtlasV3((s) => s.viewport);
  const setViewport = useAtlasV3((s) => s.setViewport);

  const tipPair = (label: string, body: string, keys?: Array<[string, string]>) => ({
    onMouseEnter: (e: React.MouseEvent) => showTooltip({ label, body, keys }, e),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  });

  const onShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
    pushToast({ glyph: "↗", label: "view permalink copied" });
  };
  const onCite = () => pushToast({ glyph: "✦", label: "cite snippet copied", em: " bibtex" });
  const onBookmark = () => pushToast({ glyph: "★", label: "view bookmarked" });

  // Region currently in focus, drives breadcrumb segment + region status card
  const focusedRegion = REGIONS.find((r) => r.id === region) ?? REGIONS[0];

  return (
    <div className="absolute inset-0 z-[10] pointer-events-none">
      {/* ── Brand block (top-left) ── */}
      <button
        type="button"
        className="absolute top-[22px] left-7 flex items-center gap-3 pointer-events-auto group cursor-pointer"
        style={{ viewTransitionName: "brand" }}
        onClick={() => {
          if (band !== "cosmos") {
            reset();
            pushToast({ glyph: "✦", label: "returned to cosmos" });
          }
        }}
        {...tipPair("brand · home", "Return to the cosmos · also a soft reset of the band.", [
          ["hover", "cursor: pointer · dot pulses"],
          ["click", "navigate atlas → cosmos"],
        ])}
      >
        <Image src="/logo/cardinal-daylight.svg" alt="" width={28} height={28} priority />
        <span className="font-display text-[22px] leading-none text-ink/94 group-hover:text-peacock transition-colors">
          Ascertainty
        </span>
        <span className="h-[5px] w-[5px] rounded-full bg-persimmon self-center" aria-hidden />
      </button>

      {/* ── Breadcrumb (top-left, below brand) ── */}
      <div className="absolute top-[60px] left-7 flex items-baseline gap-2 pointer-events-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
        <button
          type="button"
          onClick={() => setBand("cosmos")}
          className="hover:text-ink/94 transition-colors cursor-pointer"
          {...tipPair("crumb · atlas", "Top of the atlas. Click to step to cosmos.", [["click", "band → cosmos"]])}
        >
          atlas
        </button>
        <span className="text-ink/26">⟫</span>
        <button
          type="button"
          onClick={() => setBand(band)}
          className="text-ink/94"
        >
          {band}
        </button>
        {region && (
          <>
            <span className="text-ink/26">⟫</span>
            <button
              type="button"
              onClick={() => {
                setBand("domain");
                pushToast({ glyph: "⊙", label: "centered on", em: ` ${focusedRegion.name}` });
              }}
              className="font-display italic text-[13px] tracking-normal normal-case transition-colors hover:text-ink/94"
              style={{ color: focusedRegion.color }}
              {...tipPair(
                `region · ${focusedRegion.name.toLowerCase()}`,
                "The currently-focused region. Click to enter its domain.",
                [["click", "band → domain"]],
              )}
            >
              {focusedRegion.name}
            </button>
          </>
        )}
      </div>

      {/* ── Band-lock (top-center) ── */}
      <div
        className="absolute top-[22px] left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto border border-ink/12 backdrop-blur px-2 py-1.5"
        style={{ background: "rgba(250, 246, 232, 0.85)" }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/46 px-2">band</span>
        {(["cosmos", "domain", "entity", "detail"] as const).map((b) => {
          const active = band === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBand(b)}
              className={`relative font-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 cursor-pointer transition-all ${
                active
                  ? "text-peacock"
                  : "text-ink/46 hover:text-ink/94 hover:bg-ink/[0.03]"
              }`}
              style={active ? { background: "rgba(31,143,168,0.08)", border: "1px solid rgba(31,143,168,0.6)" } : undefined}
              {...tipPair(
                `band · ${b}`,
                "Lock the rendering band. Each band has its own composition — cosmos / domain / entity / detail.",
                [["click", `render band → ${b}`]],
              )}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* ── Top-right nav + wallet ── */}
      <div className="absolute top-[22px] right-7 flex items-center gap-4 pointer-events-auto font-mono text-[11px] uppercase tracking-[0.14em] text-ink/66">
        <button type="button" onClick={onShare} className="hover:text-ink/94 transition-colors cursor-pointer" {...tipPair("share", "Copy a permalink to the current view (band + region + scale).", [["click", "permalink → clipboard"]])}>
          share <span className="ml-0.5">↗</span>
        </button>
        <button type="button" onClick={onCite} className="hover:text-ink/94 transition-colors cursor-pointer" {...tipPair("cite", "Generate an attribution snippet (BibTeX / Markdown).", [["click", "opens cite dialog"]])}>
          cite
        </button>
        <button type="button" onClick={onBookmark} className="hover:text-ink/94 transition-colors cursor-pointer" {...tipPair("bookmark", "Save the current view to your atlas.", [["click", "view bookmarked"]])}>
          bookmark
        </button>
        <Link href="https://github.com/zhuyuxin0/ascertainty" target="_blank" rel="noopener noreferrer" className="hover:text-ink/94 transition-colors" {...tipPair("source · github", "Open the Ascertainty repo in a new tab.", [["click", "opens repo"]])}>
          github
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWalletMenu(!walletMenu);
          }}
          className="flex items-center gap-1.5 border border-ink/22 px-2.5 py-1 cursor-pointer hover:border-peacock transition-colors"
          {...tipPair("wallet", "0x8f2…4c1e on 0G mainnet · click for menu.", [["click", "opens wallet menu"]])}
        >
          <span className="text-peacock text-[12px]">●</span>
          <span className="text-ink/94">0G</span>
          <span className="font-hash text-ink/66 normal-case tracking-normal">0x8f2…4c1e</span>
        </button>
      </div>
      {walletMenu && <WalletMenuPlaceholder onClose={() => setWalletMenu(false)} />}

      {/* ── Now-observing (right rail, below wallet) ── */}
      <NowObserving stats={stats} observe={observe} />

      {/* ── Minimap (right rail, below now-observing) ── */}
      <Minimap viewport={viewport} scale={scale} setViewport={setViewport} tipPair={tipPair} />

      {/* ── Scale chip (right rail, below minimap) ── */}
      <ScaleChip scale={scale} setScale={setScale} tipPair={tipPair} />

      {/* ── Region status (bottom-right) ── */}
      <RegionStatus region={region} stats={stats} tipPair={tipPair} pushToast={pushToast} />

      {/* ── Bottom-left keymap hints ── */}
      <div
        className="absolute bottom-7 left-7 pointer-events-auto font-mono text-[9px] uppercase tracking-[0.22em] text-ink/46 leading-[1.7]"
        {...tipPair("gesture hints", "Mouse + keyboard guide. Press ? for the full keymap.", [["?", "open help overlay"]])}
      >
        {/* 2D cartographic plate: drag pans, scroll zooms. No rotate — the
            v2 Three.js orbit camera was retired in v3-light. */}
        <Hint k="drag" v="pan" />
        <Hint k="scroll" v="zoom" />
        <Hint k="minimap" v="snap pan" />
        <button type="button" onClick={() => setHelp(true)} className="cursor-pointer hover:text-ink/94 transition-colors flex items-baseline gap-2">
          <span className="text-ink/66">? help</span>
          <span className="text-ink/22">·</span>
          <span>open keymap</span>
        </button>
      </div>

      {/* ── Bottom-center volume strip + draw-region ── */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-ink/26">
          vol. iv · the verification quarterly · 2026
        </span>
        <button
          type="button"
          onClick={() => {
            setLasso(true);
            pushToast({ glyph: "⬚", label: "lasso engaged" });
          }}
          className="flex items-center gap-2 border border-peacock/60 backdrop-blur px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-peacock cursor-pointer hover:bg-peacock/[0.04] transition-colors"
          style={{ background: "rgba(31, 143, 168, 0.04)" }}
          {...tipPair("draw region", "Enter lasso mode to enclose a custom slice and stake on it.", [["click", "enters lasso · cursor: crosshair"]])}
        >
          <span>⬚</span>
          <span>draw region</span>
          <span className="text-ink/26">·</span>
          <span>stake</span>
        </button>
      </div>

      {/* ── Demo bar (dev only) ── */}
      {process.env.NODE_ENV !== "production" && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-auto font-mono text-[9px] uppercase tracking-[0.18em]">
          {([
            ["agent", () => togglePanel("agent")],
            ["bounties", () => togglePanel("bounties")],
            ["model", () => togglePanel("model")],
            ["market", () => togglePanel("market")],
            ["library", () => setLibrary(true)],
            ["lasso", () => setLasso(true)],
            ["help", () => setHelp(true)],
          ] as const).map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              className="border border-ink/22 bg-cream-card/60 px-2 py-0.5 text-ink/66 hover:text-ink/94 hover:border-peacock transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Hint({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-ink/66">{k}</span>
      <span className="text-ink/22">·</span>
      <span>{v}</span>
    </div>
  );
}

function NowObserving({ stats, observe }: { stats: LiveStats; observe: ReturnType<typeof useAtlasV3.getState>["observe"] }) {
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);
  const setBand = useAtlasV3((s) => s.setBand);
  const togglePanel = useAtlasV3((s) => s.togglePanel);
  const pushToast = useAtlasV3((s) => s.pushToast);

  const tipNow = {
    onMouseEnter: (e: React.MouseEvent) =>
      showTooltip(
        {
          label: "now observing",
          body: "Live event feed — settle, solve, contest, spot, market. Click a row to jump to its source.",
          keys: [["click", "jumps to event"]],
        },
        e,
      ),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  };

  // Static demo feed; Phase 5+ will wire to real /atlas events
  const feed: Array<[string, string, string, string, () => void]> = [
    ["✓", "settle", "prime-gap lemma settled", "2m", () => { setBand("detail"); pushToast({ glyph: "↗", label: "jumped to bounty" }); }],
    ["↗", "solve", "claude-4.5 cited on lattice", "4m", () => togglePanel("model")],
    ["!", "contest", "Mediterranean claim contested", "8m", () => togglePanel("bounties")],
    ["▸", "spot", "Carl spotted number-theory", "12m", () => setBand("domain")],
    ["⨯", "mkt", "Opus 4.5 market resolved YES", "18m", () => togglePanel("market")],
    ["↗", "solve", "gpt-5-turbo scored 94.2", "22m", () => togglePanel("model")],
  ];

  return (
    <div
      className="absolute top-[22px] left-7 mt-[100px] pointer-events-auto border border-ink/12 backdrop-blur w-[260px]"
      style={{ background: "rgba(250, 246, 232, 0.92)" }}
      {...tipNow}
    >
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-ink/12">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/46">now observing</span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-peacock">
          <span className="h-[5px] w-[5px] rounded-full bg-peacock animate-pulse" />
          live
        </span>
      </div>
      <div className="flex flex-col">
        {feed.map(([g, t, b, tm, fn], i) => (
          <button
            key={i}
            type="button"
            onClick={fn}
            className="px-3 py-2 grid grid-cols-[16px_1fr_auto] gap-2 items-baseline text-left font-mono text-[10px] hover:bg-ink/[0.03] transition-colors cursor-pointer border-b border-ink/12 last:border-b-0"
          >
            <span className={`text-[11px] ${t === "settle" ? "text-peacock" : t === "contest" || t === "mkt" ? "text-rose" : "text-persimmon"}`}>
              {g}
            </span>
            <span className="text-ink/94 truncate">
              <em className="not-italic font-display italic text-[11px] tracking-normal normal-case text-ink/66 mr-1">
                {t}
              </em>
              {b}
            </span>
            <span className="text-ink/46 tabular-nums">{tm}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Minimap planet positions match the cosmos region/placeholder positions
 * scaled into the 168×100 minimap. (Cosmos coords are 0-1600 × 0-900;
 * we map to 0-100% × 0-100% of the minimap.) */
const MINIMAP_PLANETS: Array<{ id: string; color: string; cx: number; cy: number; clickable: boolean; label: string }> = [
  { id: "ai-models",          color: "#7B5BA8",            cx: 1100 / 1600, cy: 280 / 900, clickable: true,  label: "AI Models" },
  { id: "math-proofs",        color: "#2A7A8F",            cx: 540  / 1600, cy: 600 / 900, clickable: true,  label: "Math Proofs" },
  { id: "prediction-markets", color: "#B85A42",            cx: 1280 / 1600, cy: 720 / 900, clickable: true,  label: "Prediction Markets" },
  { id: "defi-security",      color: "rgba(10,21,37,0.22)", cx: 220 / 1600, cy: 230 / 900, clickable: false, label: "DeFi Security" },
  { id: "scientific-claims",  color: "rgba(10,21,37,0.22)", cx: 820 / 1600, cy: 90  / 900, clickable: false, label: "Scientific Claims" },
  { id: "engineering",        color: "rgba(10,21,37,0.22)", cx: 180 / 1600, cy: 730 / 900, clickable: false, label: "Engineering" },
];

/** Recenter the cosmos on a stage-space point (cx, cy in 0-1 normalized).
 *  Computes the viewport that puts that point at the center of the
 *  current viewBox slice. Capped so the viewport never tries to pan
 *  beyond the canvas edges. */
function recenterOn(cx: number, cy: number, scale: number): { x: number; y: number } {
  const fracVisible = 1 / scale;
  const halfVisible = fracVisible / 2;
  // Viewport.x in 0..1 means the viewBox left edge is at panRange * x of stage.
  // To center on cx, we want viewBox-left + halfVisible = cx → vp = (cx - half) / (1 - frac)
  const denom = 1 - fracVisible;
  if (denom <= 0) return { x: 0, y: 0 }; // fully visible, no pan possible
  return {
    x: Math.max(0, Math.min(1, (cx - halfVisible) / denom)),
    y: Math.max(0, Math.min(1, (cy - halfVisible) / denom)),
  };
}

function Minimap({
  viewport,
  scale,
  setViewport,
  tipPair,
}: {
  viewport: { x: number; y: number };
  scale: number;
  setViewport: (v: { x: number; y: number }) => void;
  tipPair: (label: string, body: string, keys?: Array<[string, string]>) => Record<string, unknown>;
}) {
  const pushToast = useAtlasV3((s) => s.pushToast);
  const setRegion = useAtlasV3((s) => s.setRegion);
  const setBand = useAtlasV3((s) => s.setBand);
  const [grabbing, setGrabbing] = useState(false);
  const dragMoved = useRef(false);

  // The viewport rect's size on the minimap = 1/scale of the canvas (the
  // fraction of the cosmos currently visible). At scale 1.0 it fills the
  // map; at scale 2.0 it's 50% × 50%. Clamped so the rect never exceeds
  // the minimap.
  const fracVisible = Math.min(1, 1 / scale);
  const rectPctW = fracVisible * 100;
  const rectPctH = fracVisible * 100;
  // Viewport.x in 0..1 maps to the rect's left in 0..(100 - rectPctW)
  const rectPctLeft = viewport.x * (100 - rectPctW);
  const rectPctTop = viewport.y * (100 - rectPctH);

  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset?.planet) return; // let planet handle it
    const map = e.currentTarget;
    const rect = map.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    setGrabbing(true);
    dragMoved.current = false;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      if (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005) dragMoved.current = true;
      // Drag distance translates to viewport delta — rect can move 0..(1-frac)
      // of the minimap, but we let viewport.x stay in 0..1 (cosmos handles cap)
      setViewport({
        x: Math.max(0, Math.min(1, start.vx + dx)),
        y: Math.max(0, Math.min(1, start.vy + dy)),
      });
    };
    const onUp = (ev: MouseEvent) => {
      setGrabbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // If user didn't drag, treat it as a click-to-recenter on that
      // map coordinate. Translates the click position into stage-space
      // and recenters there.
      if (!dragMoved.current) {
        const px = (ev.clientX - rect.left) / rect.width;
        const py = (ev.clientY - rect.top) / rect.height;
        setViewport(recenterOn(px, py, scale));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onPlanetClick = (planet: typeof MINIMAP_PLANETS[number]) => {
    if (!planet.clickable) {
      pushToast({ glyph: "✕", label: "placeholder · not navigable" });
      return;
    }
    setViewport(recenterOn(planet.cx, planet.cy, scale));
    setRegion(planet.id as "ai-models" | "math-proofs" | "prediction-markets");
    if (scale < 1.2) {
      // Auto-step into domain for the recentered region per "tap planet
      // to recenter" — visiting that planet is the natural drill-in.
      setBand("domain");
    }
    pushToast({ glyph: "⊙", label: "recentered on", em: ` ${planet.label}` });
  };

  return (
    <div
      className="absolute top-[140px] right-7 pointer-events-auto border border-ink/12 backdrop-blur"
      style={{ background: "rgba(250, 246, 232, 0.92)" }}
    >
      <div className="flex items-baseline justify-between px-3 py-1.5 border-b border-ink/12 gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/46">minimap</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/46 tabular-nums">
          x {viewport.x.toFixed(2)} · y {viewport.y.toFixed(2)}
        </span>
      </div>
      <div
        onMouseDown={onDown}
        className="relative w-[168px] h-[100px] bg-cream-soft"
        style={{
          backgroundImage: `
            linear-gradient(rgba(10,21,37,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10,21,37,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "10px 10px",
          cursor: grabbing ? "grabbing" : "crosshair",
        }}
        {...tipPair("minimap", "Drag to pan · click to recenter · tap a planet to fly there.", [
          ["drag", "pan cosmos"],
          ["click empty", "recenter on point"],
          ["click planet", "fly to that region"],
        ])}
      >
        {MINIMAP_PLANETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-planet={p.id}
            onClick={(e) => {
              e.stopPropagation();
              onPlanetClick(p);
            }}
            title={p.label + (p.clickable ? "" : " · placeholder")}
            className="absolute h-2 w-2 rounded-full pointer-events-auto"
            style={{
              left: `${p.cx * 100}%`,
              top: `${p.cy * 100}%`,
              background: p.color,
              transform: "translate(-50%, -50%)",
              cursor: p.clickable ? "pointer" : "not-allowed",
              boxShadow: p.clickable ? "0 0 0 2px rgba(250,246,232,0.7)" : undefined,
            }}
          />
        ))}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${rectPctLeft}%`,
            top: `${rectPctTop}%`,
            width: `${rectPctW}%`,
            height: `${rectPctH}%`,
            border: "1px solid var(--peacock)",
            background: "rgba(31,143,168,0.06)",
            transition: grabbing ? "none" : "all 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

function ScaleChip({
  scale,
  setScale,
  tipPair,
}: {
  scale: number;
  setScale: (n: number) => void;
  tipPair: (label: string, body: string, keys?: Array<[string, string]>) => Record<string, unknown>;
}) {
  const [grabbing, setGrabbing] = useState(false);

  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const start = { x: e.clientX, s: scale };
    setGrabbing(true);
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x;
      setScale(start.s + dx / 80);
    };
    const onUp = () => {
      setGrabbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const pct = ((scale - 0.4) / 3.2) * 100;

  return (
    <div
      onMouseDown={onDown}
      className="absolute top-[262px] right-7 pointer-events-auto flex items-center gap-2 border border-ink/12 backdrop-blur px-2.5 py-1 w-[168px] select-none"
      style={{
        background: "rgba(250, 246, 232, 0.92)",
        cursor: grabbing ? "grabbing" : "grab",
      }}
      {...tipPair("z-depth", "Drag horizontally to change zoom. Persists across band changes.", [["drag", "cursor: grabbing"]])}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/46">z-depth</span>
      <div className="relative flex-1 h-1 bg-ink/12">
        <div className="absolute inset-y-0 left-0 bg-peacock" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 bg-peacock"
          style={{ left: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-ink/94">{scale.toFixed(1)}</span>
    </div>
  );
}

function RegionStatus({
  region,
  stats,
  tipPair,
  pushToast,
}: {
  region: ReturnType<typeof useAtlasV3.getState>["region"];
  stats: LiveStats;
  tipPair: (label: string, body: string, keys?: Array<[string, string]>) => Record<string, unknown>;
  pushToast: ReturnType<typeof useAtlasV3.getState>["pushToast"];
}) {
  // When no region selected, show global stats; otherwise the focused region card
  const showsGlobal = region === null;
  const r = REGIONS.find((x) => x.id === region) ?? REGIONS[0];
  const counts: Record<string, number> = {
    "ai-models": stats.modelCount,
    "math-proofs": stats.liveBounties,
    "prediction-markets": stats.marketCount,
  };

  return (
    <div
      className="absolute bottom-7 right-7 pointer-events-auto border-l-2 border border-ink/12 px-4 py-3 w-[260px] backdrop-blur"
      style={{
        background: "rgba(250, 246, 232, 0.92)",
        borderLeftColor: showsGlobal ? "rgba(10,21,37,0.18)" : r.color,
      }}
      {...tipPair("live region", "The currently focused region. Click the name to recenter the cosmos on it.", [["click", "recenter cosmos"]])}
    >
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink/46">
        <span className="h-[5px] w-[5px] rounded-full bg-peacock animate-pulse" />
        <span>{showsGlobal ? "global" : "live region"}</span>
      </div>
      <button
        type="button"
        onClick={() => !showsGlobal && pushToast({ glyph: "⊙", label: "recentered on", em: ` ${r.name}` })}
        className="mt-1 font-display italic text-[20px] leading-tight text-ink/94 cursor-pointer hover:opacity-80 transition-opacity"
        style={!showsGlobal ? { color: r.color } : undefined}
      >
        {showsGlobal ? "All regions" : r.name}
      </button>
      <div className="mt-1 font-mono text-[10px] text-ink/66 leading-snug">
        {showsGlobal ? "Three live regions · three Q3-Q4 placeholders" : r.subtitle}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/46">
        <Stat k={showsGlobal ? "bounties" : "entities"} v={String(showsGlobal ? stats.liveBounties : counts[r.id])} c={showsGlobal ? "var(--peacock)" : r.color} />
        <Stat k={showsGlobal ? "models" : "families"} v={String(showsGlobal ? stats.modelCount : 12)} c="var(--ink)" />
        <Stat k={showsGlobal ? "paid wk" : "staked"} v={`⌥ ${Math.round(stats.weeklyPaidUsd / 100) / 10}k`} c="var(--ink)" />
      </div>
    </div>
  );
}

function Stat({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span>{k}</span>
      <span className="font-display text-[18px] leading-none tabular-nums" style={{ color: c }}>
        {v}
      </span>
    </div>
  );
}

function WalletMenuPlaceholder({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-wallet-menu]")) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      data-wallet-menu
      className="absolute top-[64px] right-7 pointer-events-auto border border-ink/12 backdrop-blur px-4 py-3 w-[240px] z-20"
      style={{ background: "rgba(250, 246, 232, 0.96)" }}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/46 mb-2">wallet · 0G mainnet</div>
      <div className="font-hash text-[12px] text-ink/94 mb-3">0x8f2…4c1e</div>
      <div className="flex flex-col gap-1.5 font-mono text-[11px] text-ink/66">
        <button type="button" className="text-left hover:text-peacock transition-colors cursor-pointer">copy address</button>
        <button type="button" className="text-left hover:text-peacock transition-colors cursor-pointer">view on explorer ↗</button>
        <button type="button" className="text-left hover:text-rose transition-colors cursor-pointer">disconnect</button>
      </div>
    </div>
  );
}
