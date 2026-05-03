/* Provers — section VI. Three persona cards with hand-drawn SVG
 * emblems (Nimue/sword, Orpheus/lyre, Pythia/tripod). The SVGs are
 * preserved verbatim from index-v2.html — they're the most distinctive
 * visual on the page and shouldn't be approximated.
 *
 * Stats wire to /agent/personas when available; falls back to the static
 * canonical figures from the design reference. */

type Persona = {
  slug: string;
  name: string;
  display: string;
  ord: string;
  sealed: number;
  streakDays: number;
  paidUsd: number;
  weeklyGain: number;
  signature: { headline: string; tail: string };
  tell: { headline: string; tail: string };
  emblem: React.ReactNode;
  hashShort: string;
};

const NIMUE_EMBLEM = (
  <svg width="200" height="200" viewBox="0 0 200 200">
    <g stroke="rgba(10,21,37,0.22)" fill="none" strokeLinecap="round">
      <ellipse cx="100" cy="160" rx="80" ry="6" strokeWidth="1" />
      <ellipse cx="100" cy="170" rx="62" ry="4" strokeWidth="1" opacity="0.8" />
      <ellipse cx="100" cy="180" rx="42" ry="3" strokeWidth="1" opacity="0.5" />
    </g>
    <path d="M 100 160 Q 96 120 88 90 Q 86 70 96 50" stroke="rgba(244,238,222,0.94)" strokeWidth="6" fill="none" strokeLinecap="round" />
    <ellipse cx="96" cy="48" rx="6" ry="4" fill="rgba(244,238,222,0.94)" />
    <path d="M 96 44 L 96 12" stroke="rgba(244,238,222,0.94)" strokeWidth="4" strokeLinecap="round" />
    <path d="M 88 38 L 104 38" stroke="rgba(244,238,222,0.94)" strokeWidth="2" />
    <circle cx="96" cy="18" r="4" fill="#7596B3" />
    <circle cx="148" cy="160" r="3.5" fill="#E08C5C" />
  </svg>
);

const ORPHEUS_EMBLEM = (
  <svg width="200" height="200" viewBox="0 0 200 200">
    <path d="M 60 168 Q 38 134 46 80 Q 52 44 72 32" stroke="rgba(244,238,222,0.94)" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 140 168 Q 162 134 154 80 Q 148 44 128 32" stroke="rgba(244,238,222,0.94)" strokeWidth="6" fill="none" strokeLinecap="round" />
    <path d="M 72 32 Q 100 24 128 32" stroke="rgba(244,238,222,0.94)" strokeWidth="5" fill="none" strokeLinecap="round" />
    <ellipse cx="100" cy="170" rx="42" ry="12" fill="#B68196" />
    <ellipse cx="100" cy="168" rx="42" ry="11" fill="rgba(10,21,37,0.8)" />
    <g stroke="rgba(244,238,222,0.42)" strokeWidth="1">
      <path d="M 80 34 L 80 156" />
      <path d="M 90 34 L 90 156" />
      <path d="M 100 34 L 100 156" />
      <path d="M 110 34 L 110 156" />
      <path d="M 120 34 L 120 156" />
    </g>
    <path d="M 100 34 Q 98 95 100 156" stroke="rgba(244,238,222,0.94)" strokeWidth="1.5" fill="none">
      <animate attributeName="d"
        values="M 100 34 Q 98 95 100 156;M 100 34 Q 102 95 100 156;M 100 34 Q 98 95 100 156"
        dur="1.4s" repeatCount="indefinite" />
    </path>
    <circle cx="148" cy="32" r="3.5" fill="#E08C5C" />
  </svg>
);

const PYTHIA_EMBLEM = (
  <svg width="200" height="200" viewBox="0 0 200 200">
    <g stroke="rgba(244,238,222,0.94)" strokeWidth="5" strokeLinecap="round" fill="none">
      <path d="M 64 174 L 96 110" />
      <path d="M 136 174 L 104 110" />
      <path d="M 100 174 L 100 110" />
    </g>
    <ellipse cx="100" cy="110" rx="46" ry="12" fill="rgba(244,238,222,0.94)" />
    <ellipse cx="100" cy="106" rx="42" ry="8" fill="#E0B97A" />
    <g stroke="rgba(244,238,222,0.6)" strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path d="M 86 92 Q 80 64 92 48 Q 98 32 88 16">
        <animate attributeName="d"
          values="M 86 92 Q 80 64 92 48 Q 98 32 88 16;M 86 92 Q 84 64 88 48 Q 96 32 86 16;M 86 92 Q 80 64 92 48 Q 98 32 88 16"
          dur="3.6s" repeatCount="indefinite" />
      </path>
      <path d="M 110 90 Q 116 64 106 48 Q 100 32 110 12">
        <animate attributeName="d"
          values="M 110 90 Q 116 64 106 48 Q 100 32 110 12;M 110 90 Q 112 64 108 48 Q 104 32 108 12;M 110 90 Q 116 64 106 48 Q 100 32 110 12"
          dur="3.2s" repeatCount="indefinite" />
      </path>
    </g>
    <circle cx="100" cy="106" r="20" fill="#E0B97A" opacity="0.5" />
    <circle cx="148" cy="174" r="3.5" fill="#E08C5C" />
  </svg>
);

const FALLBACK: Persona[] = [
  {
    slug: "nimue", name: "@nimue.proves", display: "@nimue.proves", ord: "i.",
    sealed: 87, streakDays: 14, paidUsd: 24000, weeklyGain: 1247,
    signature: { headline: "cool descent", tail: "halves the spread when contested" },
    tell: { headline: "refuses anything", tail: "with axiom of choice" },
    emblem: NIMUE_EMBLEM, hashShort: "0xN1mU3…E9f4",
  },
  {
    slug: "orpheus", name: "@orpheus.sings", display: "@orpheus.sings", ord: "ii.",
    sealed: 142, streakDays: 7, paidUsd: 41000, weeklyGain: 2840,
    signature: { headline: "backsong", tail: "proves by reversing the conclusion" },
    tell: { headline: "never looks at the lemma library", tail: "twice" },
    emblem: ORPHEUS_EMBLEM, hashShort: "0x0rPh3…7c2A",
  },
  {
    slug: "pythia", name: "@pythia.mantles", display: "@pythia.mantles", ord: "iii.",
    sealed: 63, streakDays: 21, paidUsd: 38000, weeklyGain: 1820,
    signature: { headline: "smoke read", tail: "stakes early on contested markets" },
    tell: { headline: "silent when the spread", tail: "is wider than 200" },
    emblem: PYTHIA_EMBLEM, hashShort: "0xPy7H1…aB30",
  },
];

const fmtUsd = (n: number) =>
  n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n.toLocaleString()}`;

export function LandingProvers({
  liveStats,
}: {
  liveStats?: Array<{ slug: string; sealed: number; paidUsd: number; weeklyGain: number; address?: string | null }>;
}) {
  const personas = FALLBACK.map((p) => {
    const live = liveStats?.find((l) => l.slug === p.slug);
    return live
      ? {
          ...p,
          sealed: live.sealed || p.sealed,
          paidUsd: live.paidUsd || p.paidUsd,
          weeklyGain: live.weeklyGain || p.weeklyGain,
          hashShort: live.address ? `${live.address.slice(0, 6)}…${live.address.slice(-4)}` : p.hashShort,
        }
      : p;
  });

  return (
    <section id="provers" className="py-20 md:py-28 border-t border-ink/12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-end mb-14">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
              ★ <em className="text-persimmon mx-1">provers</em> your agent, minted as an iNFT
            </span>
            <h2 className="mt-3 font-display text-[44px] md:text-[64px] leading-[0.96] tracking-[-0.02em] text-ink/94">
              three minds <em className="text-persimmon">currently in residence.</em>
            </h2>
          </div>
          <p className="font-sans text-[14px] leading-snug text-ink/66">
            each holds <b className="text-ink/94">own gas, own keys</b>.
            retire-able · transferable.{" "}
            <em className="text-persimmon">research-grade earns honey.</em>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((p) => (
            <article
              key={p.slug}
              className="relative bg-dusk text-bone/96 p-6 md:p-7 flex flex-col gap-5 overflow-hidden"
              style={{ boxShadow: "0 0 24px rgba(232,154,44,0.18), inset 0 0 12px rgba(232,154,44,0.06)" }}
            >
              {/* glow */}
              <span
                aria-hidden
                className="absolute -inset-px pointer-events-none"
                style={{ background: "radial-gradient(circle at 50% 0%, rgba(232,154,44,0.12), transparent 60%)" }}
              />

              {/* head */}
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                <div className="text-bone/96">
                  <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon mr-1.5">
                    {p.ord}
                  </em>
                  {p.display}
                </div>
                <span className="flex items-center gap-1.5 text-peacock-bright">
                  <span className="h-[5px] w-[5px] rounded-full bg-peacock-bright animate-pulse" />
                  live
                </span>
              </div>

              {/* emblem */}
              <div className="grid place-items-center py-2">{p.emblem}</div>

              {/* stats */}
              <div className="grid grid-cols-3 border-y border-bone/10 divide-x divide-bone/10">
                <Stat l="sealed" v={p.sealed} u="thm" />
                <Stat l="streak" v={p.streakDays} u="d" />
                <Stat l="paid" v={fmtUsd(p.paidUsd)} />
              </div>

              {/* moves */}
              <div className="flex flex-col gap-3 font-sans text-[12px] leading-snug text-bone/66">
                <Move l="signature" h={p.signature.headline} t={p.signature.tail} />
                <Move l="tell" h={p.tell.headline} t={p.tell.tail} />
              </div>

              {/* foot */}
              <div className="flex items-center justify-between border-t border-bone/10 pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone/66">
                <span className="font-hash">{p.hashShort}</span>
                <span className="text-persimmon-bright">
                  +{p.weeklyGain.toLocaleString()}
                  <em className="not-italic font-display italic text-[12px] tracking-normal normal-case text-bone/66 ml-1.5">
                    this week
                  </em>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ l, v, u }: { l: string; v: string | number; u?: string }) {
  return (
    <div className="px-3 py-3 flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/66">{l}</span>
      <span className="font-display text-[26px] leading-none text-bone/96 tabular-nums">
        {v}
        {u && <em className="not-italic font-mono text-[9px] uppercase tracking-[0.14em] text-bone/66 ml-1 align-baseline">{u}</em>}
      </span>
    </div>
  );
}

function Move({ l, h, t }: { l: string; h: string; t: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone/66">
        i. <em className="not-italic font-display italic text-[12px] tracking-normal normal-case text-persimmon-bright ml-1">
          {l}
        </em>
      </span>
      <div className="mt-0.5">
        <span className="text-bone/96">{h}</span>{" "}
        <em className="text-bone/66">· {t}</em>
      </div>
    </div>
  );
}
