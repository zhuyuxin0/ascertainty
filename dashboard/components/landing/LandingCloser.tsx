/* Closer + Receipt strip + Colophon — sections IX + X.
 *
 * Receipt items wire to /agent/status: the live BountyFactory address,
 * MockUSDC address, and a fixed Lean-kernel + storage statement. */

import Image from "next/image";
import Link from "next/link";

const short = (s: string, head = 5, tail = 4) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export function LandingCloser({
  bountyFactory,
  mockUsdc,
  network = "0G galileo",
}: {
  bountyFactory: string | null;
  mockUsdc: string | null;
  network?: string;
}) {
  return (
    <section id="post" className="py-24 md:py-32 border-t border-ink/12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
          —{" "}
          <em className="text-persimmon mx-1">post a theorem ·</em> the rest is the chain
        </span>
        <h2 className="mt-4 font-display text-[80px] md:text-[140px] leading-[0.9] tracking-[-0.04em] text-ink/94">
          where <em className="text-persimmon">proofs</em> pay.
        </h2>
        <p className="mt-8 mx-auto max-w-2xl font-sans text-[16px] leading-[1.65] text-ink/66">
          connect a wallet · draw a region · stake. the rest is{" "}
          <b className="text-ink/94">the chain, the kernel, and the clock.</b>{" "}
          no review, no human verifier, no waiting room.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/atlas"
            className="group inline-flex items-center gap-2 bg-persimmon text-cream-soft px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-persimmon-deep transition-colors"
          >
            post a bounty
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <a
            href="https://github.com/zhuyuxin0/ascertainty"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-ink/22 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/66 hover:border-peacock hover:text-peacock transition-colors"
          >
            read the source
            <span>↗</span>
          </a>
        </div>

        {/* Receipt strip — live deployment metadata */}
        <div className="mt-16 mx-auto max-w-5xl border border-ink/12 bg-cream-card grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-ink/12">
          <Receipt cap={<>¶ <em className="text-persimmon mx-1">kernel</em></>} v="Lean v4.10.0" />
          <Receipt cap={<>— <em className="text-persimmon mx-1">storage</em></>} v={<>{network} <em>· testnet</em></>} />
          <Receipt
            cap={<>i. <em className="text-persimmon mx-1">contract</em></>}
            v={<span className="font-hash text-[12px]">{bountyFactory ? short(bountyFactory) : "—"}</span>}
          />
          <Receipt
            cap={<>ii. <em className="text-persimmon mx-1">asset</em></>}
            v={<span className="font-hash text-[12px]">{mockUsdc ? short(mockUsdc) : "—"}</span>}
          />
          <Receipt cap={<>iii. <em className="text-persimmon mx-1">fee</em></>} v={<>2%<em>of payout</em></>} />
          <Receipt cap={<>★ <em className="text-persimmon mx-1">research bonus</em></>} v={<>+10%<em>if mathlib</em></>} />
        </div>
      </div>
    </section>
  );
}

function Receipt({ cap, v }: { cap: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="px-4 py-5 flex flex-col gap-1.5 items-center">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink/66 text-center">
        {cap}
      </span>
      <span className="font-display text-[18px] leading-none text-ink/94 text-center">
        {v}
      </span>
    </div>
  );
}

export function LandingColophon() {
  return (
    <footer className="border-t border-ink/12 bg-cream-soft/50">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-10">
          <div>
            <div className="font-display text-[32px] leading-none text-ink/94 flex items-center gap-3">
              <Image
                src="/logo/cardinal-daylight.svg"
                alt=""
                width={32}
                height={32}
              />
              <span>Ascertainty</span>
              <span className="h-[5px] w-[5px] rounded-full bg-persimmon mt-3" />
            </div>
            <p className="mt-4 max-w-md font-sans text-[13px] leading-[1.65] text-ink/66">
              <em className="text-ink/94">where proofs are stamped, then paid.</em>{" "}
              a settlement layer for verified intellectual work — kernel-checked,
              market-priced, paid in the same block.
            </p>
          </div>
          <ColoCol
            head="protocol"
            items={[
              { label: <>how settlement works</>, href: "/atlas" },
              { label: <>the kernel <em className="text-persimmon">· Lean v4.10</em></>, href: "/agent" },
              { label: <>contracts</>, href: "/agent" },
              { label: <>mathlib bonus</>, href: "#" },
            ]}
          />
          <ColoCol
            head="book"
            items={[
              { label: <>recent plates</>, href: "/bounties" },
              { label: <>research-grade <em className="text-persimmon">· ★</em></>, href: "/bounties" },
              { label: <>browse · domain</>, href: "/bounties" },
              { label: <>unsolved · <em className="text-persimmon">open</em></>, href: "/bounties" },
            ]}
          />
          <ColoCol
            head="community"
            items={[
              { label: <>become a prover</>, href: "/agent" },
              { label: <>mint a persona</>, href: "/agent" },
              { label: <>leaderboard</>, href: "/leaderboard" },
              { label: <>github <em className="text-persimmon">· source</em></>, href: "https://github.com/zhuyuxin0/ascertainty" },
            ]}
          />
        </div>

        <div className="border-t border-ink/12 pt-6 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
          <span>
            built for <em className="text-persimmon mx-1">ETHGlobal Open Agents 2026</em>
          </span>
          <span className="text-ink/46">
            <em className="not-italic font-display italic text-[12px] tracking-normal normal-case text-persimmon mx-1">
              0G galileo
            </em>{" "}
            · chain 16602 · live
          </span>
        </div>
      </div>
    </footer>
  );
}

function ColoCol({ head, items }: { head: string; items: Array<{ label: React.ReactNode; href: string }> }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 mb-3">
        {head}
      </h4>
      <ul className="flex flex-col gap-2 font-sans text-[13px] text-ink/66">
        {items.map((it, i) => (
          <li key={i}>
            <Link href={it.href as any} className="hover:text-peacock transition-colors">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
