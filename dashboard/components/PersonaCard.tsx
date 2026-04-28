"use client";

import { useState } from "react";

import { TheoremSigil } from "@/components/TheoremSigil";

type Badge = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "uncommon" | "rare";
  earned_at?: number;
};

type DomainTag = { tag: string; count: number };

type Stats = {
  attempts: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
  avg_kernel_seconds: number | null;
  fastest_kernel_seconds: number | null;
  settled_count: number;
  domain_tags: DomainTag[];
};

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  profile: string;
  axiom_breadth: number;
  address: string | null;
  token_id: number | null;
  storage_root_hash: string | null;
  descriptor: string | null;
  version: string | null;
  minted_at: number | null;
  reputation: number;
  solved_count: number;
  stats?: Stats;
  earned_badges?: Badge[];
  worn_badges?: string[];
};

const EXPLORER = "https://chainscan-galileo.0g.ai";

const RARITY_BORDER: Record<string, string> = {
  common: "border-white/30",
  uncommon: "border-cyan/60",
  rare: "border-amber",
};

export function PersonaCard({
  persona,
  catalog = [],
  apiBase,
}: {
  persona: Persona;
  catalog?: Badge[];
  apiBase: string;
}) {
  const stats = persona.stats;
  const earned = persona.earned_badges ?? [];
  const worn = new Set(persona.worn_badges ?? []);
  const wornBadges = earned.filter((b) => worn.has(b.slug));
  const lockedBadges = catalog.filter(
    (b) => !earned.some((e) => e.slug === b.slug),
  );
  const breadthPct = Math.round((persona.axiom_breadth / 6) * 100);
  const acceptancePct = stats ? Math.round(stats.acceptance_rate * 100) : 0;

  return (
    <div
      className="border bg-bg/60 backdrop-blur p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{ borderColor: persona.color }}
    >
      {/* Persona sigil — derived from on-chain address, distinct per persona */}
      <div className="absolute top-3 right-3 opacity-90" aria-hidden>
        <TheoremSigil
          hash={persona.address ?? "0x0"}
          color={persona.color}
          size={56}
          label={`${persona.name} persona sigil`}
        />
      </div>

      {/* Header */}
      <div className="relative pr-16">
        <a
          href={persona.address ? `${EXPLORER}/address/${persona.address}` : "#"}
          target={persona.address ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            persona iNFT{persona.token_id !== null ? ` · #${persona.token_id}` : ""}
          </div>
          <div
            className="font-sans text-2xl font-light mt-0.5 group-hover:underline flex items-center gap-2"
            style={{ color: persona.color }}
          >
            <span className="text-xl">{persona.emoji}</span>
            <span>{persona.name}</span>
          </div>
          <div className="font-mono text-[10px] text-white/60 mt-0.5">
            {persona.tagline}
          </div>
        </a>
      </div>

      {/* Worn badges (pinned to the card face) */}
      {wornBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 relative">
          {wornBadges.map((b) => (
            <BadgePill key={b.slug} badge={b} />
          ))}
        </div>
      )}

      {/* Live stats grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-1 relative">
        <Stat
          label="reputation"
          value={persona.reputation.toString()}
          color={persona.color}
        />
        <Stat
          label="settled wins"
          value={(stats?.settled_count ?? persona.solved_count).toString()}
          color={persona.color}
        />
        <Stat
          label="accept rate"
          value={stats ? `${acceptancePct}%` : "—"}
          color={persona.color}
          sub={stats ? `${stats.accepted}/${stats.attempts}` : ""}
        />
        <Stat
          label="kernel speed"
          value={
            stats?.avg_kernel_seconds != null
              ? `${stats.avg_kernel_seconds.toFixed(2)}s`
              : "—"
          }
          color={persona.color}
          sub={
            stats?.fastest_kernel_seconds != null
              ? `pb ${stats.fastest_kernel_seconds.toFixed(2)}s`
              : ""
          }
        />
      </div>

      {/* Domain affinities */}
      {stats && stats.domain_tags.length > 0 && (
        <div className="relative">
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1">
            domain affinities
          </div>
          <div className="flex flex-wrap gap-1">
            {stats.domain_tags.slice(0, 6).map(({ tag, count }) => (
              <span
                key={tag}
                className="font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5"
                style={{
                  borderColor: persona.color + "60",
                  color: persona.color,
                }}
                title={`${count} accepted submission${count === 1 ? "" : "s"} on ${tag}`}
              >
                {tag} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Axiom breadth bar */}
      <div className="relative">
        <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1">
          axiom whitelist breadth
        </div>
        <div className="h-1 bg-line">
          <div
            className="h-full"
            style={{ width: `${breadthPct}%`, background: persona.color }}
          />
        </div>
      </div>

      {/* Trophy shelf — expandable */}
      <TrophyShelf
        persona={persona}
        earned={earned}
        worn={worn}
        locked={lockedBadges}
        apiBase={apiBase}
      />

      {/* Footer */}
      <div className="border-t border-line/50 pt-3 mt-1 relative">
        <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
          address
        </div>
        <div className="font-mono text-[10px] text-white/85 truncate">
          {persona.address ? short(persona.address, 10, 8) : "—"}
        </div>
      </div>
    </div>
  );
}

function TrophyShelf({
  persona,
  earned,
  worn,
  locked,
  apiBase,
}: {
  persona: Persona;
  earned: Badge[];
  worn: Set<string>;
  locked: Badge[];
  apiBase: string;
}) {
  const [open, setOpen] = useState(false);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [localWorn, setLocalWorn] = useState<Set<string>>(worn);

  async function toggleWear(badgeSlug: string) {
    setSavingSlug(badgeSlug);
    const next = new Set(localWorn);
    if (next.has(badgeSlug)) next.delete(badgeSlug);
    else next.add(badgeSlug);
    try {
      const res = await fetch(`${apiBase}/agent/personas/${persona.slug}/wear`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ badges: Array.from(next) }),
      });
      if (res.ok) {
        setLocalWorn(next);
      }
    } finally {
      setSavingSlug(null);
    }
  }

  if (earned.length === 0 && locked.length === 0) return null;

  return (
    <div className="relative border-t border-line/50 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-white/70 flex items-center justify-between w-full"
      >
        <span>
          trophy shelf · {earned.length} earned · {locked.length} locked
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {earned.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {earned.map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => toggleWear(b.slug)}
                  disabled={savingSlug === b.slug}
                  className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 transition-colors disabled:opacity-50 ${
                    localWorn.has(b.slug)
                      ? RARITY_BORDER[b.rarity]
                      : "border-line/50 text-white/40 hover:text-white/70"
                  }`}
                  title={
                    localWorn.has(b.slug)
                      ? `${b.description}\n— click to hide from card`
                      : `${b.description}\n— click to wear on card`
                  }
                >
                  {b.emoji} {b.name}
                </button>
              ))}
            </div>
          )}
          {locked.length > 0 && (
            <div className="flex flex-wrap gap-1.5 opacity-50">
              {locked.map((b) => (
                <span
                  key={b.slug}
                  className="font-mono text-[10px] uppercase tracking-widest border border-line/30 text-white/30 px-2 py-0.5 grayscale"
                  title={`Locked: ${b.description}`}
                >
                  🔒 {b.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BadgePill({ badge }: { badge: Badge }) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${RARITY_BORDER[badge.rarity]}`}
      title={badge.description}
    >
      {badge.emoji} {badge.name}
    </span>
  );
}

function Stat({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[9px] text-white/40 tabular-nums">{sub}</span>
      )}
    </div>
  );
}

function short(s: string, head = 6, tail = 4): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
