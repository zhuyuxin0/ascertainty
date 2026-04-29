"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { API_URL } from "@/lib/api";

/**
 * Floating, draggable persona inspector.
 *
 * Replaces the previous `router.push("/agent")` jump from a minion
 * capsule click. The route switch caused a full page transition + cold
 * navigation; this drawer keeps the cosmos alive in the background and
 * lets the user move the panel out of the way to compare against the
 * map. Dragged via framer-motion; constrained to the viewport so it
 * cannot fling off-screen.
 */

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  profile?: string;
  address: string | null;
  token_id: number | null;
  storage_root_hash?: string | null;
  reputation: number;
  solved_count: number;
  earned_badges?: Array<{ slug: string; emoji: string; name: string }>;
};

const EXPLORER = "https://chainscan-galileo.0g.ai";

export function PersonaDetailPanel({
  slug,
  onClose,
}: {
  slug: string | null;
  onClose: () => void;
}) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) {
      setPersona(null);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: Persona[] }) => {
        const p = (d.personas ?? []).find((x) => x.slug === slug) ?? null;
        setPersona(p);
      })
      .catch(() => setPersona(null))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <AnimatePresence>
      {slug && (
        <motion.div
          key="persona-panel"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: "spring", damping: 26, stiffness: 240 }}
          drag
          dragMomentum={false}
          dragConstraints={{ left: -800, right: 800, top: -300, bottom: 300 }}
          dragElastic={0.04}
          className="fixed top-1/2 left-1/2 z-40 pointer-events-auto cursor-grab active:cursor-grabbing"
          style={{ x: "-50%", y: "-50%" }}
        >
          <div
            className="border bg-panel/95 backdrop-blur w-[420px] max-w-[90vw] shadow-2xl"
            style={{
              borderColor: persona?.color ?? "#1A1C26",
              boxShadow: persona
                ? `0 24px 80px -20px ${persona.color}55, 0 0 0 1px ${persona.color}30`
                : "0 24px 80px -20px rgba(0,0,0,0.7)",
            }}
          >
            {/* Drag handle / header — the grab affordance lives here */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-divider/60 select-none"
              style={{
                background: persona
                  ? `linear-gradient(180deg, ${persona.color}18 0%, transparent 100%)`
                  : undefined,
              }}
            >
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
                <span className="text-base leading-none">⋮⋮</span>
                <span>persona iNFT · drag to move</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-base text-white/40 hover:text-cyan leading-none"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            {loading && !persona && (
              <div className="p-6 font-mono text-[11px] text-white/40">
                loading persona…
              </div>
            )}

            {persona && (
              <div className="p-5 flex flex-col gap-4">
                {/* Identity */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-16 h-16 grid place-items-center text-3xl border"
                    style={{
                      borderColor: persona.color,
                      background: `${persona.color}1a`,
                      color: persona.color,
                    }}
                  >
                    {persona.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-display text-3xl leading-none"
                      style={{ color: persona.color }}
                    >
                      {persona.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">
                      token #{persona.token_id ?? "—"}
                    </p>
                    <p className="font-mono text-[11px] text-white/70 mt-2 leading-snug">
                      {persona.tagline}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="reputation"
                    value={persona.reputation.toString()}
                    color={persona.color}
                  />
                  <Stat
                    label="solved"
                    value={persona.solved_count.toString()}
                    color={persona.color}
                  />
                </div>

                {/* Badges */}
                {persona.earned_badges && persona.earned_badges.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1.5">
                      earned badges · {persona.earned_badges.length}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {persona.earned_badges.map((b) => (
                        <span
                          key={b.slug}
                          title={b.name}
                          className="border border-line/70 bg-bg/40 px-2 py-1 font-mono text-[10px] flex items-center gap-1.5 text-white/70"
                        >
                          <span className="text-sm leading-none">{b.emoji}</span>
                          <span>{b.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* On-chain */}
                <div className="space-y-1.5 pt-2 border-t border-divider/60">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                    on-chain identity
                  </p>
                  {persona.address && (
                    <Row label="address">
                      <a
                        href={`${EXPLORER}/address/${persona.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-white/85 hover:text-cyan"
                      >
                        {short(persona.address, 10, 6)} ↗
                      </a>
                    </Row>
                  )}
                  {persona.storage_root_hash && (
                    <Row label="0G storage root">
                      <span className="font-hash text-[10px] text-white/60">
                        {short(persona.storage_root_hash, 10, 6)}
                      </span>
                    </Row>
                  )}
                </div>

                {persona.profile && (
                  <p className="font-mono text-[10px] text-white/55 leading-relaxed pt-2 border-t border-divider/60">
                    {persona.profile}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="border border-line/70 bg-bg/40 p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p
        className="font-display text-2xl tabular-nums mt-1 leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-baseline">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}

function short(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
