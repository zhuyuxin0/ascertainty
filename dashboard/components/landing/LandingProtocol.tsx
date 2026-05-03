/* Protocol — section V. Three step cards: claim · contest · settle.
 * Static copy; this is editorial scaffolding for the protocol mechanic. */

const STEPS = [
  {
    ord: "01",
    sup: "claim",
    headline: <>post a theorem, <em>escrow the bounty.</em></>,
    body: <>
      draw a region · stake <b className="text-ink/94">MockUSDC</b>. the claim
      opens with a configurable challenge window.{" "}
      <em className="text-persimmon">anyone can attempt.</em>
    </>,
    tag: <>stake <em className="text-persimmon">· any amount &gt; 50</em></>,
  },
  {
    ord: "02",
    sup: "contest",
    headline: <>provers attempt; <em>markets mirror.</em></>,
    body: <>
      solvers submit <b className="text-ink/94">Lean v4.10</b> proofs against
      the kernel. predictors mirror the bounty into a spread.{" "}
      <em className="text-persimmon">the same clock settles both.</em>
    </>,
    tag: <>window <em className="text-persimmon">· then auto-close</em></>,
  },
  {
    ord: "03",
    sup: "settle",
    headline: <>the kernel reads, <em>the chain pays.</em></>,
    body: <>
      <b className="text-ink/94">0G storage</b> takes the attestation; the
      merkle root anchors via{" "}
      <em className="text-persimmon">submitProofFor</em>. the bounty leaves
      escrow in a single transaction.
    </>,
    tag: <>payout <em className="text-persimmon">· one tx, no human</em></>,
  },
];

export function LandingProtocol() {
  return (
    <section id="how" className="py-20 md:py-28">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        {/* section head */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-end mb-14">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
              ¶ <em className="text-persimmon mx-1">the protocol</em> three movements, one settlement
            </span>
            <h2 className="mt-3 font-display text-[44px] md:text-[64px] leading-[0.96] tracking-[-0.02em] text-ink/94">
              post · contest <em className="text-persimmon">· then settle.</em>
            </h2>
          </div>
          <p className="font-sans text-[14px] leading-snug text-ink/66">
            no human <b className="text-ink/94">verifier</b>. no manual{" "}
            <b className="text-ink/94">review</b>.{" "}
            <em className="text-persimmon">kernel + market + clock</em> — the
            rest is on the chain.
          </p>
        </div>

        {/* three step cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12 border border-ink/12">
          {STEPS.map((s) => (
            <article
              key={s.ord}
              className="bg-cream p-8 md:p-10 flex flex-col gap-6 min-h-[340px] hover:bg-cream-card transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[64px] leading-none text-ink/94">
                  {s.ord}
                </span>
                <sup className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                  {s.sup}
                </sup>
              </div>
              <h3 className="font-display text-[28px] leading-[1.15] tracking-[-0.01em] text-ink/94">
                {s.headline}
              </h3>
              <p className="font-sans text-[14px] leading-[1.65] text-ink/66 flex-1">
                {s.body}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 border-t border-ink/12 pt-4">
                {s.tag}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
