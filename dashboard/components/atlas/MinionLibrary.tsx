"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";

import { MinionCard } from "@/components/atlas/MinionCard";
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

type OwnedMinion = {
  token_id: number;
  owner: string;
  role: number;
  domain: string;
  seed: string;
  minted_at: number;
};

const EXPLORER = "https://chainscan-galileo.0g.ai";

/** Bottom-of-screen drawer showing the user's persona iNFTs (system-minted
 *  Andy/Carl/Bea) plus any MinionNFTs the connected wallet owns. */
export function MinionLibrary({
  refreshNonce,
  onMintClick,
}: {
  refreshNonce?: number;
  onMintClick?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [owned, setOwned] = useState<OwnedMinion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/agent/personas`)
      .then((r) => r.json())
      .then((d: { personas: Persona[] }) => setPersonas(d.personas ?? []))
      .catch(() => setPersonas([]));
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setOwned([]);
      return;
    }
    fetch(`${API_URL}/atlas/minions/${address}`)
      .then((r) => (r.ok ? r.json() : { minions: [] }))
      .then((d: { minions: OwnedMinion[] }) => setOwned(d.minions ?? []))
      .catch(() => setOwned([]));
  }, [address, isConnected, refreshNonce]);

  const totalCount = personas.length + owned.length;
  if (totalCount === 0 && !isConnected) return null;

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
              {owned.map((m) => (
                <span
                  key={`o${m.token_id}`}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: ["#00d4aa", "#ff6b35", "#a855f7"][m.role] ?? "#888",
                    boxShadow: `0 0 6px ${
                      ["#00d4aa", "#ff6b35", "#a855f7"][m.role] ?? "#888"
                    }`,
                  }}
                />
              ))}
            </span>
            <span>library · {totalCount} minions</span>
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
                library · {personas.length} persona · {owned.length} minted
              </span>
              <div className="flex items-center gap-3">
                {onMintClick && isConnected && (
                  <button
                    type="button"
                    onClick={onMintClick}
                    className="font-mono text-[10px] uppercase tracking-widest border border-cyan text-cyan px-3 py-1 hover:bg-cyan hover:text-bg transition-colors"
                  >
                    ✨ mint minion
                  </button>
                )}
                {!isConnected && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                    connect wallet to mint
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-mono text-xs text-white/40 hover:text-cyan"
                >
                  ↓
                </button>
              </div>
            </div>

            {/* Persona row (system-minted Andy/Carl/Bea) */}
            <div className="px-4 pt-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1.5">
                persona iNFTs · seeded
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {personas.map((p) => (
                  <MinionThumb key={p.slug} persona={p} />
                ))}
              </div>
            </div>

            {/* Owned MinionNFTs row */}
            {(owned.length > 0 || isConnected) && (
              <div className="px-4 pt-3 pb-4">
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1.5">
                  your minions · {owned.length} minted
                </div>
                {owned.length === 0 ? (
                  <div className="border border-dashed border-line/60 p-4 font-mono text-[10px] text-white/40 text-center">
                    no minions yet — click ✨ mint minion above
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {owned.map((m) => (
                      <MinionCard
                        key={m.token_id}
                        tokenId={m.token_id}
                        role={m.role}
                        domain={m.domain}
                        seed={m.seed}
                        mintedAt={m.minted_at}
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
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
