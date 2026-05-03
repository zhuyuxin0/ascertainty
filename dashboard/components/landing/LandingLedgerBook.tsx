/* Ledger drawers + Book of plates — sections VII + VIII.
 *
 * Both sections wire to /bounties. The ledger sorts by status (open ·
 * submitted · settled = claimed · contested · settled in design voice).
 * The book renders recently-sealed bounties as plates with domain
 * categorization and a stamp glyph chosen by status.
 *
 * If the live API has fewer than 4 bounties per drawer, we pad with the
 * canonical reference rows so the layout stays grid-correct. */

import Link from "next/link";
import type { Bounty } from "@/lib/api";

type Drawer = "claim" | "contest" | "settle";

const TINT: Record<Drawer, string> = {
  claim: "var(--persimmon)",
  contest: "var(--rose)",
  settle: "var(--peacock)",
};

const ORD: Record<Drawer, string> = { claim: "i.", contest: "ii.", settle: "iii." };
const HEAD_NAME: Record<Drawer, React.ReactNode> = {
  claim: <>posted <em>· bounty open</em></>,
  contest: <>contested <em>· market live</em></>,
  settle: <>settled <em>· closed</em></>,
};
const STAMPS: Record<string, string> = {
  open: "!", submitted: "⊞", challenged: "⊞", settled: "✓", cancelled: "⨯",
};

const fmtUsdc = (raw: string | number) => {
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Math.round(n / 1_000_000).toLocaleString();
};

function bountyToRow(b: Bounty) {
  const yaml = (b as any).spec_yaml as string | undefined;
  const titleMatch = yaml?.match(/theorem_signature:\s*["']?([^"'\n]+)/);
  const tagsMatch = yaml?.match(/tags:\s*\[?([^\]\n]+)/);
  return {
    id: b.id,
    name: titleMatch?.[1]?.trim() || `bounty #${b.id}`,
    domain: tagsMatch?.[1]?.split(",")[0]?.trim() || "lean · proof",
    usdc: fmtUsdc(b.amount_usdc),
    status: b.status,
    onchainId: b.onchain_bounty_id,
    novelty: (b as any).novelty as number | undefined,
    difficulty: (b as any).difficulty as number | undefined,
    erdosClass: (b as any).erdos_class as number | undefined,
  };
}

export function LandingLedger({ bounties }: { bounties: Bounty[] }) {
  const rows = bounties.map(bountyToRow);
  const claim = rows.filter((r) => r.status === "open").slice(0, 4);
  const contest = rows.filter((r) => r.status === "submitted" || r.status === "challenged").slice(0, 4);
  const settle = rows.filter((r) => r.status === "settled").slice(0, 4);

  return (
    <section id="ledger" className="py-20 md:py-28 border-t border-ink/12 bg-cream-soft/50">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-end mb-14">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
              — <em className="text-persimmon mx-1">the ledger</em> three drawers, one running clock
            </span>
            <h2 className="mt-3 font-display text-[44px] md:text-[64px] leading-[0.96] tracking-[-0.02em] text-ink/94">
              claimed, contested, <em className="text-persimmon">settled.</em>
            </h2>
          </div>
          <p className="font-sans text-[14px] leading-snug text-ink/66">
            rolling window. updated <b className="text-ink/94">every block</b>.
            showing <em className="text-persimmon">top 4</em> per drawer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12 border border-ink/12">
          <Drawer kind="claim" rows={claim} />
          <Drawer kind="contest" rows={contest} />
          <Drawer kind="settle" rows={settle} />
        </div>
      </div>
    </section>
  );
}

function Drawer({ kind, rows }: { kind: Drawer; rows: ReturnType<typeof bountyToRow>[] }) {
  return (
    <div className="bg-cream-card flex flex-col">
      <div
        className="flex items-baseline justify-between px-5 py-4 border-b font-mono text-[10px] uppercase tracking-[0.14em]"
        style={{ borderColor: TINT[kind], color: TINT[kind] }}
      >
        <span>
          <em className="not-italic font-display italic text-[13px] tracking-normal normal-case mr-1.5">
            {ORD[kind]}
          </em>
          {HEAD_NAME[kind]}
        </span>
        <span className="text-ink/66">{rows.length} {kind === "claim" ? "fresh" : kind === "contest" ? "active" : "this week"}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/46 text-center">
          drawer empty · awaiting first
        </div>
      ) : (
        rows.map((r) => (
          <Link
            key={r.id}
            href={`/bounty/${r.id}`}
            className="px-5 py-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-ink/12 last:border-b-0 hover:bg-cream-soft/40 transition-colors group"
          >
            <div className="font-display text-[16px] leading-snug text-ink/94">
              {r.name}
              {r.erdosClass === 1 && <span className="ml-2 text-persimmon">★</span>}
            </div>
            <div className="font-display text-[20px] leading-none tabular-nums" style={{ color: TINT[kind] }}>
              {r.usdc}
              <small className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/66 ml-1">
                {kind === "contest" ? "spread" : "USDC"}
              </small>
            </div>
            <div className="col-span-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
              {r.domain}
              {r.difficulty != null && <> · diff {r.difficulty}</>}
              {r.onchainId != null && <> · #{r.onchainId}</>}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

// ── Book of plates ───────────────────────────────────────────────────────

const PLATE_TINT: Record<string, { border: string; stamp: string; ord: string }> = {
  open:       { border: "var(--persimmon)", stamp: "var(--persimmon)", ord: "516 · open" },
  submitted:  { border: "var(--rose)",      stamp: "var(--rose)",      ord: "004 · contest" },
  challenged: { border: "var(--rose)",      stamp: "var(--rose)",      ord: "004 · contest" },
  settled:    { border: "var(--peacock)",   stamp: "var(--peacock)",   ord: "510 · sealed" },
  cancelled:  { border: "var(--paper-line-2)", stamp: "var(--paper-fg-2)", ord: "000 · withdrawn" },
};

export function LandingBook({ bounties }: { bounties: Bounty[] }) {
  // Take up to 6 plates, prioritizing settled (most worth showing on a "book")
  const settled = bounties.filter((b) => b.status === "settled").slice(0, 4);
  const others = bounties.filter((b) => b.status !== "settled").slice(0, 6 - settled.length);
  const plates = [...settled, ...others].slice(0, 6).map(bountyToRow);

  if (plates.length === 0) return null;

  return (
    <section id="book" className="py-20 md:py-28 border-t border-ink/12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-end mb-14">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
              ≡ <em className="text-persimmon mx-1">the book</em> plates currently shelved
            </span>
            <h2 className="mt-3 font-display text-[44px] md:text-[64px] leading-[0.96] tracking-[-0.02em] text-ink/94">
              recently <em className="text-persimmon">sealed.</em>
            </h2>
          </div>
          <p className="font-sans text-[14px] leading-snug text-ink/66">
            catalogued <b className="text-ink/94">dewey-style</b>. every plate
            is a <em className="text-persimmon">verifiable claim</em>;
            research-grade is marked <em className="text-persimmon">★</em>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plates.map((p) => {
            const tint = PLATE_TINT[p.status] ?? PLATE_TINT.open;
            return (
              <Link
                key={p.id}
                href={`/bounty/${p.id}`}
                className="block bg-cream-card border border-l-[6px] hover:bg-cream-soft/30 transition-colors group"
                style={{ borderColor: "var(--paper-line)", borderLeftColor: tint.border }}
              >
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4 border-b border-ink/12">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                      {tint.ord} · <em className="text-persimmon">{p.domain}</em>
                    </div>
                    <div className="mt-2 font-display text-[22px] leading-snug text-ink/94">
                      {p.name}
                      {p.erdosClass === 1 && <span className="ml-2 text-persimmon">★</span>}
                    </div>
                  </div>
                  <span
                    className="font-display text-[36px] leading-none mt-1"
                    style={{ color: tint.stamp }}
                  >
                    {STAMPS[p.status] ?? "·"}
                  </span>
                </div>
                <div className="px-5 py-5 flex flex-col gap-4">
                  {p.novelty != null && p.difficulty != null && (
                    <p className="font-sans text-[13px] leading-[1.6] text-ink/66">
                      novelty <b className="text-ink/94">{p.novelty}/10</b> ·
                      difficulty <b className="text-ink/94">{p.difficulty}/10</b>
                      {p.erdosClass === 1 && <em className="ml-2 text-persimmon">· research-grade</em>}
                    </p>
                  )}
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                    <span className="text-ink/66">
                      {p.onchainId != null ? `on-chain #${p.onchainId}` : "off-chain"}
                    </span>
                    <span className="font-display text-[18px] tabular-nums" style={{ color: tint.border }}>
                      {p.usdc}
                      <em className="not-italic font-mono text-[9px] uppercase tracking-[0.14em] text-ink/66 ml-1">USDC</em>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
