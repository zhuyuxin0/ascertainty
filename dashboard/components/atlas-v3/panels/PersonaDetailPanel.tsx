"use client";
/* PersonaDetailPanel — draggable floating modal that spawns when a
 * persona dot is clicked. Multiple can stack with x/y stagger.
 *
 * Anatomy: header drag handle + close, persona emoji + name + alias,
 * tagline, REP / SOLVED / ADDRESS grid, earned badges row,
 * INSPECT (routes to /agent) + TRANSFER (placeholder toast). */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { API_URL } from "@/lib/api";

const EXPLORER = "https://chainscan-galileo.0g.ai";
const short = (s: string, head = 6, tail = 4) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  address: string | null;
  token_id: number | null;
  reputation: number;
  solved_count: number;
  earned_badges?: Array<{ slug: string; emoji: string; name: string }>;
};

/* Literary aliases per landing page convention. */
const ALIAS: Record<string, string> = {
  "aggressive-andy": "Orpheus",
  "careful-carl": "Nimue",
  "balanced-bea": "Pythia",
};

export function PersonaDetailPanel({ slug, index }: { slug: string; index: number }) {
  const closePersona = useAtlasV3((s) => s.closePersona);
  const pushToast = useAtlasV3((s) => s.pushToast);
  const [persona, setPersona] = useState<Persona | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: Persona[] }) => setPersona(d.personas.find((p) => p.slug === slug) ?? null))
      .catch(() => setPersona(null));
  }, [slug]);

  // Stagger so multiple panels don't pile on the same pixel
  const offsetX = index * 24;
  const offsetY = index * 24;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ top: -300, left: -600, right: 600, bottom: 400 }}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="fixed z-[60] w-[400px] border bg-cream-card shadow-xl"
      style={{
        left: `calc(50% - 200px + ${offsetX}px)`,
        top: `calc(40% - 220px + ${offsetY}px)`,
        borderColor: persona?.color ?? "var(--persimmon)",
        background: "rgba(253, 250, 238, 0.98)",
      }}
    >
      {/* Header — drag handle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink/12 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
          <span className="text-ink/46">⋮⋮</span>
          <span>persona iNFT{persona?.token_id !== null ? ` · #${persona?.token_id}` : ""}</span>
        </div>
        <button
          type="button"
          onClick={() => closePersona(slug)}
          className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
          aria-label="close"
        >
          ✕
        </button>
      </div>

      <div className="p-5">
        {persona ? (
          <>
            {/* Identity */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-[40px] leading-none">{persona.emoji}</span>
              <div>
                <div className="font-display italic text-[24px] leading-tight" style={{ color: persona.color }}>
                  {persona.name}
                </div>
                {ALIAS[persona.slug] && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/46 mt-0.5">
                    alias ·{" "}
                    <em className="not-italic font-display italic text-[12px] tracking-normal normal-case text-ink/94">
                      {ALIAS[persona.slug]}
                    </em>
                  </div>
                )}
              </div>
            </div>
            <p className="font-sans text-[13px] text-ink/66 mb-5">{persona.tagline}</p>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4 border-y border-ink/12 py-3 mb-5">
              <Stat k="rep" v={persona.reputation} c={persona.color} />
              <Stat k="solved" v={persona.solved_count} c={persona.color} />
              <Stat k="address" v={persona.address ? short(persona.address) : "—"} c="var(--ink)" small />
            </div>

            {/* Badges */}
            {persona.earned_badges && persona.earned_badges.length > 0 && (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-2">
                  earned badges
                </div>
                <div className="flex flex-wrap gap-2 mb-5">
                  {persona.earned_badges.map((b) => (
                    <span key={b.slug} className="border border-ink/12 px-2 py-1 font-mono text-[10px] text-ink/94">
                      {b.emoji} {b.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href="/agent"
                className="flex-1 text-center border border-peacock/60 bg-peacock/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-peacock hover:bg-peacock hover:text-cream-card transition-colors cursor-pointer"
              >
                inspect →
              </a>
              <button
                type="button"
                onClick={() => pushToast({ glyph: "↗", label: "transfer not yet implemented" })}
                className="flex-1 border border-ink/22 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66 hover:text-ink/94 hover:border-ink/46 transition-colors cursor-pointer"
              >
                transfer
              </button>
            </div>
          </>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/46 text-center py-6">
            loading persona…
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ k, v, c, small }: { k: string; v: string | number; c: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/46">{k}</span>
      <span
        className={small ? "font-hash text-[12px] text-ink/94" : "font-display text-[28px] leading-none tabular-nums"}
        style={small ? undefined : { color: c }}
      >
        {v}
      </span>
    </div>
  );
}
