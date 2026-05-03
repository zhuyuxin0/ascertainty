/* Filing strip — six-cell horizontal row of bounty metadata.
 * Cells (mapped from claim.html → our domain):
 *   Filed by      → poster wallet (short)
 *   Cosigned      → submission count
 *   Initial stake → bounty.amount_usdc
 *   Contests      → 0 / 1 (challenged status)
 *   Verifier      → Lean v4.10 + storage anchor
 *   Hash          → spec_hash short
 */

import type { Bounty, Submission } from "@/lib/api";

const EXPLORER = "https://chainscan-galileo.0g.ai";

const fmtUsdc = (raw: string | number) => {
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Math.round(n / 1_000_000).toLocaleString();
};

const short = (s: string, head = 6, tail = 4) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export function ClaimFilingStrip({
  bounty,
  submissions,
}: {
  bounty: Bounty;
  submissions: Submission[];
}) {
  const challenged = bounty.status === "challenged";
  const acceptedSubs = submissions.filter((s) => s.accepted === 1);

  return (
    <section className="bg-cream-soft/40 border-b border-ink/12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-ink/12">
          <Cell k="Filed by">
            <a
              href={`${EXPLORER}/address/${bounty.poster}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-hash text-[12px] text-ink/94 hover:text-peacock transition-colors"
            >
              {short(bounty.poster, 6, 4)}
            </a>
          </Cell>
          <Cell k="Submissions">
            <span className="font-display text-[20px] tabular-nums text-ink/94">
              {submissions.length}
            </span>
            {acceptedSubs.length > 0 && (
              <em className="not-italic font-mono text-[10px] uppercase tracking-[0.14em] text-peacock ml-1.5">
                {acceptedSubs.length} accepted
              </em>
            )}
          </Cell>
          <Cell k="Bounty">
            <span className="font-display text-[20px] tabular-nums text-peacock">
              {fmtUsdc(bounty.amount_usdc)}
            </span>
            <em className="not-italic font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 ml-1.5">
              MockUSDC
            </em>
          </Cell>
          <Cell k="Contests" tone={challenged ? "rose" : "neutral"}>
            <span className="font-display text-[20px] tabular-nums">
              {challenged ? "1" : "0"}
            </span>
            <em
              className={`not-italic font-mono text-[10px] uppercase tracking-[0.14em] ml-1.5 ${
                challenged ? "text-rose" : "text-ink/66"
              }`}
            >
              {challenged ? "live" : "open to file"}
            </em>
          </Cell>
          <Cell k="Verifier">
            <span className="font-display text-[16px] text-ink/94">
              Lean v4.10
            </span>
            <em className="not-italic font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 block mt-0.5">
              kernel · TEE-attested
            </em>
          </Cell>
          <Cell k="Spec hash">
            <span className="font-hash text-[12px] text-peacock select-all">
              {short("0x" + bounty.spec_hash, 8, 6)}
            </span>
          </Cell>
        </div>
      </div>
    </section>
  );
}

function Cell({
  k,
  tone = "neutral",
  children,
}: {
  k: string;
  tone?: "neutral" | "rose";
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 md:px-6 py-5 flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
        {k}
      </span>
      <span className="text-ink/94 leading-tight">{children}</span>
    </div>
  );
}
