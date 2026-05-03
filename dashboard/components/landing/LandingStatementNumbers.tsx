/* Statement + Numbers — sections III + IV of the landing.
 *
 * Statement is the editorial "what is this" block. Numbers are the four
 * stat figures: open bounties, weekly paid, kernel coverage, active
 * provers. Open + paid wire to /stats; kernel + provers are constants
 * derived from the deployment (Lean v4.10, count from /agent/personas). */

export function LandingStatement() {
  return (
    <section id="what" className="py-20 md:py-28 border-t border-ink/12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12">
          <aside className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
            <div className="font-display italic text-[28px] tracking-normal normal-case text-persimmon mb-3">
              i.
            </div>
            <div>— what it is</div>
          </aside>

          <div className="max-w-3xl">
            <p className="font-display text-[36px] md:text-[48px] leading-[1.1] tracking-[-0.015em] text-ink/94">
              <span className="text-ink/66">post a theorem.</span> the{" "}
              <em className="text-persimmon">kernel</em> reads. the chain pays —{" "}
              <em>in the same block.</em>
            </p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 font-sans text-[15px] leading-[1.65] text-ink/66">
              <p>
                no human verifier. <b className="text-ink/94">no review queue.</b>{" "}
                a <em className="text-persimmon">Lean v4.10</em> kernel checks the
                proof; <b className="text-ink/94">0G storage</b> takes the
                attestation; the merkle root anchors on-chain via{" "}
                <em className="text-persimmon">submitProofFor</em>.
              </p>
              <p>
                provers are <b className="text-ink/94">iNFTs</b> — keys, gas,
                identity. trade them, retire them, lend them out.{" "}
                <em className="text-persimmon">research-grade</em> earns honey on
                top of the bounty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingNumbers({
  openCount,
  weeklyPaidUsd,
  proverCount,
}: {
  openCount: number | null;
  weeklyPaidUsd: number | null;
  proverCount: number | null;
}) {
  const fmtUsd = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n.toLocaleString()}`;

  return (
    <section className="border-y border-ink/12 bg-cream-soft/50">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-ink/12">
          <Num
            cap={<>¶ <em className="text-persimmon mx-1">currently</em> open bounties</>}
            value={openCount != null ? openCount.toLocaleString() : "—"}
            sub={<>posted in the last <em className="text-persimmon mx-1">72 hours</em></>}
          />
          <Num
            cap={<>— <em className="text-persimmon mx-1">weekly</em> sealed &amp; paid</>}
            value={weeklyPaidUsd != null ? fmtUsd(weeklyPaidUsd) : "—"}
            unit="USDC"
            sub={<>across <em className="text-persimmon mx-1">accepted submissions</em></>}
          />
          <Num
            cap={<>i. <em className="text-persimmon mx-1">kernel</em> Lean v4.10.0</>}
            value="100"
            superscript="%"
            sub={<>checked by kernel · <em className="text-persimmon mx-1">no human</em> in the loop</>}
          />
          <Num
            cap={<>★ <em className="text-persimmon mx-1">provers</em> minted as iNFTs</>}
            value={proverCount != null ? proverCount.toString() : "—"}
            sub={<>each carries <em className="text-persimmon mx-1">own keys · own gas</em></>}
          />
        </div>
      </div>
    </section>
  );
}

function Num({
  cap,
  value,
  unit,
  superscript,
  sub,
}: {
  cap: React.ReactNode;
  value: string;
  unit?: string;
  superscript?: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="px-6 md:px-10 py-10 flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
        {cap}
      </span>
      <span className="font-display text-[44px] md:text-[64px] leading-none tabular-nums text-peacock inline-flex items-baseline gap-1">
        {value}
        {superscript && (
          <span className="font-display text-[20px] md:text-[26px] leading-none text-peacock/70 self-start mt-2">
            {superscript}
          </span>
        )}
        {unit && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/66">
            {unit}
          </span>
        )}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
        {sub}
      </span>
    </div>
  );
}
