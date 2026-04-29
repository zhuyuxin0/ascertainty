"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { API_URL } from "@/lib/api";

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

const EXPLORER = "https://chainscan-galileo.0g.ai";

/** Bottom-of-screen drawer showing the user's persona iNFTs as a
 *  horizontal carousel. Collapsed → just a thin bar with a "library"
 *  label. Expanded → 3 cards with stats. */
export function MinionLibrary() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: Persona[] }) => setPersonas(d.personas ?? []))
      .catch(() => setPersonas([]));
  }, []);

  if (personas.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <AnimatePresence initial={false}>
        {!open && (
          <motion.button
            type="button"
            key="closed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(true)}
            className="border border-line border-b-0 bg-bg/85 backdrop-blur px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 hover:text-cyan flex items-center gap-3"
          >
            <span className="flex gap-1">
              {personas.map((p) => (
                <span
                  key={p.slug}
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }}
                />
              ))}
            </span>
            <span>library · {personas.length} minions</span>
            <span>↑</span>
          </motion.button>
        )}

        {open && (
          <motion.div
            key="open"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3 }}
            className="border border-line border-b-0 bg-bg/90 backdrop-blur"
          >
            <div className="flex items-center justify-between px-5 py-2 border-b border-line/60">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
                library · {personas.length} minted
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-xs text-white/40 hover:text-cyan"
              >
                ↓
              </button>
            </div>
            <div className="flex gap-3 px-4 py-4">
              {personas.map((p) => (
                <MinionThumb key={p.slug} persona={p} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MinionThumb({ persona }: { persona: Persona }) {
  return (
    <div
      className="border bg-bg/60 p-3 w-56 flex flex-col gap-2"
      style={{ borderColor: persona.color }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
          token #{persona.token_id ?? "—"}
        </span>
        {persona.address && (
          <a
            href={`${EXPLORER}/address/${persona.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[9px] text-white/40 hover:text-cyan"
          >
            ↗
          </a>
        )}
      </div>
      <div
        className="font-display text-base flex items-center gap-1.5"
        style={{ color: persona.color }}
      >
        <span className="text-lg">{persona.emoji}</span>
        <span>{persona.name}</span>
      </div>
      <div className="font-mono text-[9px] text-white/50 leading-snug line-clamp-1">
        {persona.tagline}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-1 text-[9px] font-mono">
        <div>
          <div className="text-white/30 uppercase tracking-widest">rep</div>
          <div className="tabular-nums" style={{ color: persona.color }}>
            {persona.reputation}
          </div>
        </div>
        <div>
          <div className="text-white/30 uppercase tracking-widest">solved</div>
          <div className="tabular-nums" style={{ color: persona.color }}>
            {persona.solved_count}
          </div>
        </div>
      </div>
      {persona.earned_badges && persona.earned_badges.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {persona.earned_badges.slice(0, 4).map((b) => (
            <span key={b.slug} className="text-sm" title={b.name}>
              {b.emoji}
            </span>
          ))}
        </div>
      )}
      <Link
        href="/agent"
        className="font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-cyan mt-1"
      >
        inspect →
      </Link>
    </div>
  );
}
