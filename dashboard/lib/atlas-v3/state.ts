/* Atlas v3 — single source of truth for the AtlasShell.
 *
 * Eleven slices on one Zustand store. Components subscribe to the
 * specific slice they need via `useAtlasV3((s) => s.band)` so a band
 * change doesn't re-render the minimap, the lasso doesn't re-render
 * the breadcrumb, etc.
 *
 * State shape mirrors the AtlasState in the design handoff
 * (design_handoff_atlas_v3/README.md § State model). */

import { create } from "zustand";

export type Band = "cosmos" | "domain" | "entity" | "detail";
export type RegionId = "math-proofs" | "ai-models" | "prediction-markets" | null;
export type PanelName =
  | "agent"
  | "bounties"
  | "model"
  | "market"
  | "library"
  | null;

export type Toast = {
  id: number;
  glyph?: string;
  label: string;
  em?: string;
  /** internal flag for outgoing animation */
  out?: boolean;
};

/** "now observing" focus — drives the bottom-right region status card. */
export type Observe =
  | { kind: "global" }
  | { kind: "region"; id: RegionId }
  | { kind: "entity"; id: string; regionId: RegionId }
  | { kind: "persona"; slug: string };

export type AtlasState = {
  // ── view state ──
  band: Band;
  region: RegionId;
  entity: string | null;
  /** open persona detail modals (multiple, draggable, stacked). */
  personas: string[];

  // ── overlay state ──
  panel: PanelName;
  library: boolean;
  lasso: boolean;
  help: boolean;
  walletMenu: boolean;
  /** when the lasso commits, the stake card anchors here (screen px). */
  stake: { x: number; y: number } | null;

  // ── chrome state ──
  observe: Observe;
  scale: number;
  viewport: { x: number; y: number };
  bookmarks: Set<string>;

  // ── toasts + tooltip ──
  toasts: Toast[];
  tooltip: TooltipData | null;

  // ── actions ──
  setBand: (b: Band) => void;
  setRegion: (r: RegionId) => void;
  setEntity: (e: string | null) => void;
  togglePanel: (p: Exclude<PanelName, null>) => void;
  closePanel: () => void;
  openPersona: (slug: string) => void;
  closePersona: (slug: string) => void;
  setLibrary: (open: boolean) => void;
  setLasso: (active: boolean) => void;
  setHelp: (open: boolean) => void;
  setWalletMenu: (open: boolean) => void;
  setStake: (s: { x: number; y: number } | null) => void;
  setObserve: (o: Observe) => void;
  setScale: (n: number) => void;
  setViewport: (v: { x: number; y: number }) => void;
  toggleBookmark: (key: string) => void;
  pushToast: (t: Omit<Toast, "id" | "out">) => void;
  dismissToast: (id: number) => void;
  showTooltip: (data: TooltipPayload, e: { clientX: number; clientY: number }) => void;
  moveTooltip: (e: { clientX: number; clientY: number }) => void;
  hideTooltip: () => void;
  /** Soft reset: panels + selection + lasso + help cleared, band → cosmos. */
  reset: () => void;
};

export type TooltipPayload = {
  label: string;
  body?: string;
  keys?: Array<[string, string]>;
};
export type TooltipData = TooltipPayload & { x: number; y: number };

let toastCounter = 0;

export const useAtlasV3 = create<AtlasState>((set, get) => ({
  // initial
  band: "cosmos",
  region: null,
  entity: null,
  personas: [],
  panel: null,
  library: false,
  lasso: false,
  help: false,
  walletMenu: false,
  stake: null,
  observe: { kind: "global" },
  scale: 1.2,
  viewport: { x: 0.42, y: 0.18 },
  bookmarks: new Set(),
  toasts: [],
  tooltip: null,

  // actions
  setBand: (band) => set({ band }),
  setRegion: (region) => set({ region }),
  setEntity: (entity) => set({ entity }),
  togglePanel: (p) => {
    const cur = get().panel;
    set({ panel: cur === p ? null : p });
  },
  closePanel: () => set({ panel: null }),
  openPersona: (slug) => {
    if (get().personas.includes(slug)) return;
    set({ personas: [...get().personas, slug] });
  },
  closePersona: (slug) => set({ personas: get().personas.filter((s) => s !== slug) }),
  setLibrary: (library) => set({ library }),
  setLasso: (lasso) => set({ lasso, stake: lasso ? null : get().stake }),
  setHelp: (help) => set({ help }),
  setWalletMenu: (walletMenu) => set({ walletMenu }),
  setStake: (stake) => set({ stake }),
  setObserve: (observe) => set({ observe }),
  setScale: (n) => set({ scale: Math.max(0.4, Math.min(3.6, n)) }),
  setViewport: (viewport) => set({ viewport }),
  toggleBookmark: (key) => {
    const next = new Set(get().bookmarks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    set({ bookmarks: next });
  },

  pushToast: (t) => {
    const id = ++toastCounter;
    const toast: Toast = { id, ...t };
    set({ toasts: [...get().toasts, toast] });
    // animate-out then remove
    window.setTimeout(() => {
      set({ toasts: get().toasts.map((x) => (x.id === id ? { ...x, out: true } : x)) });
    }, 2200);
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((x) => x.id !== id) });
    }, 2500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  showTooltip: (data, e) => set({ tooltip: { ...data, x: e.clientX, y: e.clientY } }),
  moveTooltip: (e) => {
    const t = get().tooltip;
    if (!t) return;
    set({ tooltip: { ...t, x: e.clientX, y: e.clientY } });
  },
  hideTooltip: () => set({ tooltip: null }),

  reset: () =>
    set({
      band: "cosmos",
      region: null,
      entity: null,
      personas: [],
      panel: null,
      library: false,
      lasso: false,
      help: false,
      walletMenu: false,
      stake: null,
      observe: { kind: "global" },
    }),
}));

/** Selector helper for component-local subscriptions. Use over the bare
 *  `useAtlasV3((s) => …)` only when the shape is non-trivial. */
export const selectBand = (s: AtlasState) => s.band;
export const selectPanel = (s: AtlasState) => s.panel;
export const selectLasso = (s: AtlasState) => s.lasso;
