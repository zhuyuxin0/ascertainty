/* Claim banner — filing id + theorem headline + lede on the left,
 * status block + figure on the right.
 *
 * Status semantics (matches Settlement Authority + bounty lifecycle):
 *   open         → "Open · accepting proofs"   peacock pill
 *   submitted    → "Submitted · contest window" persimmon pill
 *   challenged   → "Challenged · under review"  rose pill
 *   settled      → "Settled · sealed"           peacock pill
 *   cancelled    → "Cancelled · refunded"       neutral pill
 *
 * The "confidence figure" on the design slot is repurposed for our domain
 * as either the bounty's AI rating (novelty + difficulty) when present, or
 * the live USDC amount as the headline number. */

import type { Bounty, Submission } from "@/lib/api";

const EXPLORER = "https://chainscan-galileo.0g.ai";

const STATUS_PILL: Record<string, { label: string; tone: "peacock" | "persimmon" | "rose" | "neutral" }> = {
  open:       { label: "Open · accepting proofs",     tone: "peacock" },
  submitted:  { label: "Submitted · contest window",  tone: "persimmon" },
  challenged: { label: "Challenged · under review",    tone: "rose" },
  settled:    { label: "Settled · sealed",             tone: "peacock" },
  cancelled:  { label: "Cancelled · refunded",         tone: "neutral" },
};

const TONE: Record<string, string> = {
  peacock: "border-peacock bg-peacock/10 text-peacock",
  persimmon: "border-persimmon bg-persimmon/10 text-persimmon",
  rose: "border-rose bg-rose/10 text-rose",
  neutral: "border-ink/22 bg-ink/10 text-ink/66",
};

const fmtUsdc = (raw: string | number) => {
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Math.round(n / 1_000_000).toLocaleString();
};

function extractTheorem(yaml?: string): string {
  if (!yaml) return "";
  const m = yaml.match(/theorem_signature:\s*["']?([^"'\n]+)/);
  return m?.[1]?.trim() ?? "";
}
function extractDomain(yaml?: string): string {
  if (!yaml) return "Lean · proof";
  const m = yaml.match(/tags:\s*\[?([^\]\n]+)/);
  return m?.[1]?.split(",")[0]?.trim() ?? "Lean · proof";
}

function fmtFiledDate(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtCloses(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Filing ID format: № AC-YYYYMMDD-{onchain or db}.
 *  Anchored to created_at so the same bounty always shows the same ID. */
function makeFilingId(b: Bounty): string {
  const d = new Date(b.created_at * 1000);
  const yyyymmdd =
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  const tail = b.onchain_bounty_id != null
    ? String(b.onchain_bounty_id).padStart(4, "0")
    : `OFF${String(b.id).padStart(3, "0")}`;
  return `№ AC-${yyyymmdd}-${tail}`;
}

export function ClaimBanner({ bounty, submissions }: { bounty: Bounty; submissions: Submission[] }) {
  const theorem = extractTheorem(bounty.spec_yaml);
  const domain = extractDomain(bounty.spec_yaml);
  const status = STATUS_PILL[bounty.status] ?? STATUS_PILL.open;
  const acceptedCount = submissions.filter((s) => s.accepted === 1).length;
  const totalCount = submissions.length;

  return (
    <section className="border-b border-ink/12 py-12 md:py-16">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-6">
              <span className="font-mono text-[12px] tracking-[0.18em] text-ink/94 select-all">
                {makeFilingId(bounty)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
                Filed{" "}
                <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon ml-1">
                  {fmtFiledDate(bounty.created_at)}
                </em>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
                Domain ·{" "}
                <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon ml-1">
                  {domain}
                </em>
              </span>
              {bounty.erdos_class === 1 && (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] border border-persimmon bg-persimmon/15 text-persimmon-deep px-2 py-0.5">
                  ★ research-grade
                </span>
              )}
            </div>

            <h1 className="font-display text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.018em] text-ink/94">
              {theorem || `Bounty proceedings for claim #${bounty.onchain_bounty_id ?? bounty.id}`}
            </h1>

            {bounty.tee_explanation && (
              <p className="mt-6 max-w-3xl font-sans text-[15px] md:text-[17px] leading-[1.6] text-ink/66 italic">
                {bounty.tee_explanation}
              </p>
            )}
          </div>

          {/* Status block */}
          <div className="flex flex-col gap-4 border-l-0 lg:border-l border-ink/12 lg:pl-10">
            <div className={`inline-flex w-fit items-center font-mono text-[10px] uppercase tracking-[0.16em] border px-3 py-1.5 ${TONE[status.tone]}`}>
              {status.label}
            </div>

            <div className="flex flex-col gap-2.5 font-mono text-[11px] text-ink/66">
              <Row k="stage">
                <span className="uppercase tracking-[0.14em]">{bounty.status}</span>
              </Row>
              <Row k="closes">
                {fmtCloses(bounty.deadline_unix)}
              </Row>
              <Row k="window">
                {bounty.challenge_window_seconds}s challenge
              </Row>
              <Row k="resolver">
                Lean v4.10 kernel · 0G TEE
              </Row>
              {bounty.tx_hash && (
                <Row k="tx">
                  <a
                    href={`${EXPLORER}/tx/${bounty.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-hash text-[11px] text-peacock hover:underline"
                  >
                    {bounty.tx_hash.slice(0, 8)}…{bounty.tx_hash.slice(-6)}
                  </a>
                </Row>
              )}
            </div>

            {/* Headline figure: USDC amount */}
            <div className="border-t border-ink/12 pt-5 mt-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
                  Bounty
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-peacock">
                  MockUSDC
                </span>
              </div>
              <div className="font-display text-[64px] leading-none tabular-nums text-peacock">
                {fmtUsdc(bounty.amount_usdc)}
              </div>
              <div className="mt-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                <span>{totalCount} {totalCount === 1 ? "submission" : "submissions"}</span>
                <span>{acceptedCount} accepted</span>
              </div>
              {(bounty.novelty != null || bounty.difficulty != null) && (
                <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                  <span>novelty <span className="text-ink/94">{bounty.novelty ?? "—"}/10</span></span>
                  <span>difficulty <span className="text-ink/94">{bounty.difficulty ?? "—"}/10</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 items-baseline">
      <span className="uppercase tracking-[0.14em] text-ink/66 text-[10px]">{k}</span>
      <span className="text-ink/94">{children}</span>
    </div>
  );
}
