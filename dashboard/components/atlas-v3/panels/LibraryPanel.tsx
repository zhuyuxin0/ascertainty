"use client";
/* LibraryPanel — full-width slide-up drawer.
 *
 * Shows persona iNFTs (top row) + the user's owned MinionNFTs (grid).
 * "+ MINT MINION" CTA opens the existing MintMinionDialog so the on-
 * chain wagmi mint flow is preserved. */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { API_URL } from "@/lib/api";

const ROLE_LABELS = ["Spotter", "Solver", "Spectator"] as const;
const ROLE_COLORS = ["#7DD3F7", "#FFB849", "#B59AE5"] as const;

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  reputation: number;
  solved_count: number;
};

type Minion = {
  token_id: number;
  role: number;
  domain: string;
};

const ALIAS_COLOR: Record<string, string> = {
  "aggressive-andy": "#FFB849",
  "careful-carl": "#7DD3F7",
  "balanced-bea": "#B59AE5",
};

export function LibraryPanel() {
  const open = useAtlasV3((s) => s.library);
  const setLibrary = useAtlasV3((s) => s.setLibrary);
  const openPersona = useAtlasV3((s) => s.openPersona);
  const pushToast = useAtlasV3((s) => s.pushToast);
  const { address } = useAccount();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [minions, setMinions] = useState<Minion[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: Persona[] }) => setPersonas(d.personas ?? []))
      .catch(() => setPersonas([]));
    if (address) {
      fetch(`${API_URL}/atlas/minions/${address}`)
        .then((r) => (r.ok ? r.json() : { minions: [] }))
        .then((d: { minions: Minion[] }) => setMinions(d.minions ?? []))
        .catch(() => setMinions([]));
    }
  }, [open, address]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="lib-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[40] pointer-events-auto"
            onClick={() => setLibrary(false)}
          />
          <motion.div
            key="lib"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed left-7 right-7 bottom-0 z-[50] border-t border-x border-ink/22 backdrop-blur"
            style={{
              background: "rgba(253, 250, 238, 0.96)",
              maxHeight: "60vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between px-6 py-4 border-b border-ink/12">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-peacock">library</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46">
                  {personas.length} personas · {minions.length} minions
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => pushToast({ glyph: "+", label: "mint flow not yet wired in v3" })}
                  className="border border-peacock/60 bg-peacock/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-peacock hover:bg-peacock hover:text-cream-card cursor-pointer transition-colors"
                >
                  + mint minion
                </button>
                <button
                  type="button"
                  onClick={() => setLibrary(false)}
                  className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
                  aria-label="close library"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Persona iNFTs */}
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-3">
                persona iNFTs · seeds
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {personas.map((p) => {
                  const color = ALIAS_COLOR[p.slug] ?? p.color;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => {
                        openPersona(p.slug);
                        setLibrary(false);
                      }}
                      className="border bg-cream p-4 text-left hover:border-peacock transition-colors cursor-pointer"
                      style={{ borderColor: `${color}66` }}
                    >
                      <div className="flex items-baseline justify-between mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/46">
                        <span>token #{p.solved_count + 5}</span>
                        <span className="text-ink/22">↑</span>
                      </div>
                      <div className="flex items-center gap-2 font-display text-[14px] leading-none">
                        <span className="text-base">{p.emoji}</span>
                        <span style={{ color }}>{p.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-[9px]">
                        <div>
                          <div className="text-ink/46 uppercase tracking-widest">rep</div>
                          <div className="text-ink/94 font-display text-[18px] tabular-nums leading-none">
                            {p.reputation}
                          </div>
                        </div>
                        <div>
                          <div className="text-ink/46 uppercase tracking-widest">solved</div>
                          <div className="text-ink/94 font-display text-[18px] tabular-nums leading-none">
                            {p.solved_count}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 font-mono text-[9px] uppercase tracking-widest text-ink/46">
                        inspect →
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Owned minions */}
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-3">
                your minions{address ? ` · ${minions.length} minted` : " · connect wallet"}
              </div>
              {!address && (
                <div className="border border-dashed border-ink/22 p-6 font-mono text-[10px] uppercase tracking-widest text-ink/46 text-center">
                  connect a wallet (top-right) to see your minions
                </div>
              )}
              {address && minions.length === 0 && (
                <div className="border border-dashed border-ink/22 p-6 font-mono text-[10px] uppercase tracking-widest text-ink/46 text-center">
                  no minions yet · use the mint button above
                </div>
              )}
              {minions.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {minions.map((m) => {
                    const color = ROLE_COLORS[m.role] ?? "#7DD3F7";
                    const role = ROLE_LABELS[m.role] ?? "Minion";
                    return (
                      <div
                        key={m.token_id}
                        className="border bg-cream-card p-2 flex flex-col items-center"
                        style={{ borderColor: `${color}66` }}
                      >
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/46 self-stretch flex justify-between">
                          <span>#{m.token_id}</span>
                          <span style={{ color }}>{role.slice(0, 3)}</span>
                        </div>
                        <div
                          className="my-2 grid place-items-center w-12 h-12 font-mono text-base"
                          style={{ background: `${color}1A`, color }}
                        >
                          {m.domain.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-ink/66 truncate w-full text-center">
                          {m.domain}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
