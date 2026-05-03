"use client";
/* AtlasShell — composition root for v3 atlas.
 *
 * Mounts: Field (cream paper backdrop) ▸ Cosmos (SVG canvas) ▸ HUD
 * (chrome) ▸ side panels ▸ floating modals (persona detail, lasso,
 * help) ▸ ambient overlays (tooltip, toast).
 *
 * Owns no view state itself — the Zustand store at lib/atlas-v3/state.ts
 * is the single source of truth. Live counts loaded from /atlas/models,
 * /atlas/markets, /bounties on mount.
 *
 * URL persistence: band/region/entity reflect into the query string
 * (?band=domain&region=ai-models) so links + back/forward navigation
 * restore state. Bookmarks live in localStorage. */

import { useEffect, useState } from "react";

import { useAtlasV3, type Band, type RegionId } from "@/lib/atlas-v3/state";
import { API_URL } from "@/lib/api";

import { Field } from "./field/Field";
import { Cosmos } from "./Cosmos";
import { HUD } from "./HUD";
import { TooltipLayer, ToastStack } from "./overlays/TooltipToast";
import { AgentPanel } from "./panels/AgentPanel";
import { BountiesPanel } from "./panels/BountiesPanel";
import { ModelPanel, MarketPanel } from "./panels/ModelMarketPanels";
import { LibraryPanel } from "./panels/LibraryPanel";
import { PersonaDetailPanel } from "./panels/PersonaDetailPanel";
import { LassoOverlay } from "./overlays/Lasso";
import { HelpOverlay } from "./overlays/Help";

type LiveStats = {
  liveBounties: number;
  weeklyPaidUsd: number;
  modelCount: number;
  marketCount: number;
};

const SEVEN_DAYS = 7 * 24 * 60 * 60;

async function loadStats(): Promise<LiveStats> {
  const fallback: LiveStats = { liveBounties: 0, weeklyPaidUsd: 0, modelCount: 50, marketCount: 60 };
  try {
    const [bountiesR, modelsR, marketsR] = await Promise.all([
      fetch(`${API_URL}/bounties?limit=200`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/atlas/models`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/atlas/markets`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]);
    const now = Math.floor(Date.now() / 1000);
    const bounties = bountiesR?.bounties ?? [];
    const models = modelsR?.models ?? [];
    const markets = marketsR?.markets ?? [];
    return {
      liveBounties: bounties.filter((b: { status: string }) => b.status === "open").length || fallback.liveBounties,
      weeklyPaidUsd:
        bounties
          .filter((b: { status: string; created_at: number }) => b.status === "settled" && now - b.created_at <= SEVEN_DAYS)
          .reduce((sum: number, b: { amount_usdc: string }) => sum + parseInt(b.amount_usdc, 10) / 1_000_000, 0) ||
        fallback.weeklyPaidUsd,
      modelCount: models.length || fallback.modelCount,
      marketCount: markets.length || fallback.marketCount,
    };
  } catch {
    return fallback;
  }
}

export function AtlasShell() {
  const [stats, setStats] = useState<LiveStats>({
    liveBounties: 0,
    weeklyPaidUsd: 0,
    modelCount: 50,
    marketCount: 60,
  });
  const setHelp = useAtlasV3((s) => s.setHelp);
  const setLasso = useAtlasV3((s) => s.setLasso);
  const setLibrary = useAtlasV3((s) => s.setLibrary);
  const closePanel = useAtlasV3((s) => s.closePanel);
  const setBand = useAtlasV3((s) => s.setBand);
  const setRegion = useAtlasV3((s) => s.setRegion);
  const personas = useAtlasV3((s) => s.personas);
  const band = useAtlasV3((s) => s.band);
  const region = useAtlasV3((s) => s.region);

  useEffect(() => {
    loadStats().then(setStats).catch(() => {});
  }, []);

  // ── URL → state on mount: ?band=domain&region=ai-models ──
  // (raw URL parsing avoids the Suspense boundary requirement of
  //  next/navigation's useSearchParams.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const b = params.get("band") as Band | null;
    const r = params.get("region") as RegionId | null;
    if (b && ["cosmos", "domain", "entity", "detail"].includes(b)) setBand(b);
    if (r && ["math-proofs", "ai-models", "prediction-markets"].includes(r)) setRegion(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── State → URL: shallow query-string sync (no nav, replaceState) ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (band !== "cosmos") url.searchParams.set("band", band);
    else url.searchParams.delete("band");
    if (region) url.searchParams.set("region", region);
    else url.searchParams.delete("region");
    window.history.replaceState({}, "", url.toString());
  }, [band, region]);

  // Global keys: ?, esc, l, ⌘k, b
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const s = useAtlasV3.getState();
      if (e.key === "Escape") {
        if (s.help) setHelp(false);
        else if (s.lasso || s.stake) {
          s.setLasso(false);
          s.setStake(null);
        } else if (s.library) setLibrary(false);
        else if (s.personas.length) s.closePersona(s.personas[s.personas.length - 1]);
        else if (s.panel) closePanel();
      } else if (e.key === "?") {
        setHelp(true);
      } else if (e.key === "l" && !s.lasso) {
        setLasso(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setLibrary(!s.library);
      } else if (e.key === "b") {
        s.pushToast({ glyph: "★", label: "view bookmarked" });
        try {
          const url = window.location.href;
          const stored = JSON.parse(localStorage.getItem("atlas_bookmarks") ?? "[]") as string[];
          if (!stored.includes(url)) localStorage.setItem("atlas_bookmarks", JSON.stringify([...stored, url]));
        } catch {
          /* localStorage may be denied; toast already shown */
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setHelp, setLasso, setLibrary, closePanel]);

  return (
    <Field>
      <Cosmos modelCount={stats.modelCount} marketCount={stats.marketCount} bountyCount={stats.liveBounties} />
      <HUD stats={stats} />

      {/* Side panels — exclusive, max one open */}
      <AgentPanel />
      <BountiesPanel />
      <ModelPanel />
      <MarketPanel />

      {/* Library — bottom slide-up drawer, exclusive of panels */}
      <LibraryPanel />

      {/* Persona detail modals — multiple, draggable, stacked with offset */}
      {personas.map((slug, i) => (
        <PersonaDetailPanel key={slug} slug={slug} index={i} />
      ))}

      {/* Lasso draw layer + post-commit StakeSheet */}
      <LassoOverlay />

      {/* Help keymap card */}
      <HelpOverlay />

      {/* Ambient overlays — always on top */}
      <TooltipLayer />
      <ToastStack />
    </Field>
  );
}
