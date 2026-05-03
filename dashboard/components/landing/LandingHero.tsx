"use client";
/* Landing hero — eyebrow row + AS-CERTAIN-TY letterform + foot row +
 * atlas portal teaser.
 *
 * The letterform is the existing brand mechanic from
 * components/atlas/ASCertaintyOverlay.tsx, translated onto the cream
 * paper field. Same auto-cycling S extension (Stop / Studio / Strategy /
 * Symposium / STEM / Story), same hover-revealed CERTAIN principles
 * (Claims / Evidence / Resolution / Tradeable / Agents / Information
 * depth / Navigable), same "A {word} of CERTAIN to you" tagline. The
 * source-of-truth data lives in @/lib/ascertaintyMeanings — both the
 * dramatic /atlas overlay and this hero render from it. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  AS_EXTENSIONS,
  ASCERTAINTY_LETTERS as LETTERS,
  CERTAIN_MEANINGS,
  CERTAIN_RANGE,
  S_INDEX,
} from "@/lib/ascertaintyMeanings";

export function LandingHero({
  openCount,
  weeklyPaidUsd,
}: {
  openCount: number | null;
  weeklyPaidUsd: number | null;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [sHovered, setSHovered] = useState(false);
  const [extIdx, setExtIdx] = useState(0);

  // Auto-cycle the AS-extension every 1.8s. Pauses on S-hover so users can read.
  useEffect(() => {
    if (sHovered) return;
    const iv = window.setInterval(() => {
      setExtIdx((i) => (i + 1) % AS_EXTENSIONS.length);
    }, 1800);
    return () => window.clearInterval(iv);
  }, [sHovered]);

  const ext = AS_EXTENSIONS[extIdx];

  const fmtUsd = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n.toLocaleString()}`;

  return (
    <section className="relative pt-[120px] pb-12">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        {/* eyebrow row — left: tagline, right: open-bounty count.
            Replaces the editorial "vol. iv · the verification quarterly"
            framing with product-true status. */}
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
          <span>
            ¶{" "}
            <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon mx-1">
              where proofs pay
            </em>{" "}
            a verification oracle on 0G
          </span>
          <span>
            <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon mx-1">
              {openCount ?? "—"}
            </em>{" "}
            bounties open right now
          </span>
        </div>

        {/* AS-CERTAIN-TY — color choreography matches the dramatic /atlas
            overlay, translated onto cream:
              A and TY  → dark navy ink (was white-on-dark)
              S         → persimmon, auto-cycling word above
              CERTAIN   → peacock, hover for principle
            Same source data; just the field inverts. */}
        <div className="mt-14 flex justify-center">
          <h1
            className="flex items-baseline gap-1 sm:gap-2 select-none font-display"
            aria-label="Ascertainty"
          >
            {LETTERS.map((ch, i) => {
              const isS = i === S_INDEX;
              const inCertain =
                i >= CERTAIN_RANGE[0] && i <= CERTAIN_RANGE[1];
              const meaning = inCertain ? CERTAIN_MEANINGS[ch] : null;
              const isHovered = hoveredIdx === i;

              let colorClass = "text-ink/94"; // A and TY — dark navy on cream
              if (isS) colorClass = "text-persimmon";
              else if (inCertain) colorClass = "text-peacock";

              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      delay: 0.06 * i,
                      duration: 0.5,
                      ease: "easeOut",
                    },
                  }}
                  onMouseEnter={() => {
                    if (inCertain) setHoveredIdx(i);
                    if (isS) setSHovered(true);
                  }}
                  onMouseLeave={() => {
                    setHoveredIdx(null);
                    if (isS) setSHovered(false);
                  }}
                  className={`relative text-7xl sm:text-8xl md:text-9xl leading-none ${colorClass} ${
                    inCertain || isS ? "cursor-help" : ""
                  }`}
                  style={
                    inCertain || isS
                      ? {
                          animation: isS
                            ? "pulsePersimmon 1.8s ease-in-out infinite"
                            : "pulsePeacock 3s ease-in-out infinite",
                          animationDelay: `${i * 0.18}s`,
                        }
                      : undefined
                  }
                >
                  {ch}

                  {/* S extension — small caption ABOVE the S, vertically
                      stacked so it doesn't push CERTAIN sideways. */}
                  {isS && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={ext.tail}
                        initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="absolute left-1/2 -translate-x-1/2 -top-12 sm:-top-14 md:-top-16 font-display text-3xl sm:text-4xl md:text-5xl text-persimmon leading-none pointer-events-none whitespace-nowrap"
                        style={{ textShadow: "0 0 18px rgba(232, 154, 44, 0.35)" }}
                      >
                        <span className="opacity-50">s</span>
                        {ext.tail.toLowerCase()}
                      </motion.span>
                    </AnimatePresence>
                  )}

                  {/* CERTAIN tooltip */}
                  {isHovered && meaning && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-peacock pointer-events-none"
                    >
                      <span className="block">{meaning.word}</span>
                      <span className="block text-ink/66 font-sans normal-case text-[11px] mt-1">
                        {meaning.gloss}
                      </span>
                    </motion.span>
                  )}

                  {/* S tooltip — current word + gloss + audience */}
                  {isS && sHovered && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-persimmon-deep pointer-events-none"
                    >
                      <span className="block">A {ext.word.toLowerCase()}</span>
                      <span className="block text-ink/66 font-sans normal-case text-[11px] mt-1">
                        {ext.gloss}
                      </span>
                      <span className="block text-ink/66 mt-1 text-[9px]">
                        {ext.audience}
                      </span>
                    </motion.span>
                  )}
                </motion.span>
              );
            })}
          </h1>
        </div>

        {/* Tagline — "A {word} of CERTAIN to you." */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 1.2, duration: 0.8 } }}
          className="mt-16 text-center font-display italic text-2xl sm:text-3xl tracking-wide"
        >
          <span className="text-ink/94 not-italic">A</span>{" "}
          <AnimatePresence mode="wait">
            <motion.span
              key={ext.word}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4 }}
              className="text-persimmon not-italic inline-block"
            >
              {ext.word.toLowerCase()}
            </motion.span>
          </AnimatePresence>{" "}
          <span className="text-ink/94 not-italic">of</span>{" "}
          <span className="text-peacock not-italic font-semibold tracking-[0.2em]">
            CERTAIN
          </span>{" "}
          <span className="text-ink/94 not-italic">to you.</span>
        </motion.p>

        {/* sub — lifted to /66 so it actually reads */}
        <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink/66">
          information has depth · navigate it
        </p>

        {/* foot row: lede / status pill / cta */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] items-end gap-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
              — what it is
            </span>
            <h2 className="mt-3 font-display font-normal text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.01em] text-ink/94">
              a settlement layer for{" "}
              <em className="text-ink/66">verified intellectual work</em>.{" "}
              <em className="text-ink/66">information has depth — navigate it.</em>
            </h2>
          </div>

          <div className="flex items-center gap-2 border border-ink/22 bg-cream-card px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/94">
            <span className="h-[6px] w-[6px] rounded-full bg-peacock animate-pulse" />
            <span className="text-peacock">live</span>
            <span className="text-ink/66">·</span>
            <span>{openCount ?? "—"} open</span>
            <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-ink/66 mx-1">
              ·
            </em>
            <span>
              {weeklyPaidUsd != null ? fmtUsd(weeklyPaidUsd) : "$—"} paid this week
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/atlas"
              className="group inline-flex items-center gap-2 bg-persimmon text-cream-card px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-persimmon-deep transition-colors"
            >
              enter the atlas
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 border border-ink/22 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/94 hover:border-peacock hover:text-peacock transition-colors"
            >
              how it settles
              <span>↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* atlas portal — full-bleed teaser bottom of hero */}
      <Link
        href="/atlas"
        className="block mt-20 mx-auto max-w-[1640px] px-6 md:px-14"
      >
        <div className="relative overflow-hidden border border-bone/10 bg-dusk text-bone grid grid-cols-1 md:grid-cols-[1fr_240px_auto] items-center gap-8 p-8 md:p-12">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/66">
              ↗ companion view
            </span>
            <h3 className="mt-3 font-display font-normal text-[42px] md:text-[56px] leading-[0.92] tracking-[-0.02em]">
              /<em className="text-peacock-bright">atlas</em>
            </h3>
            <p className="mt-4 max-w-md font-sans text-[14px] leading-snug text-bone/66">
              a cosmos of verified knowledge — math · models · markets, with
              cross-domain proof arcs.
            </p>
          </div>
          <div className="hidden md:block" aria-hidden="true">
            <svg viewBox="0 0 200 200" className="w-full">
              <defs>
                <radialGradient id="ap-halo">
                  <stop offset="0%" stopColor="#C7A6FF" stopOpacity="0.55" />
                  <stop offset="60%" stopColor="#C7A6FF" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#C7A6FF" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="ap-icos" cx="35%" cy="35%">
                  <stop offset="0%" stopColor="#E2D0FF" />
                  <stop offset="55%" stopColor="#C7A6FF" />
                  <stop offset="100%" stopColor="#5E468F" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="95" fill="url(#ap-halo)" />
              <g style={{ transformOrigin: "100px 100px", animation: "ap-spin 30s linear infinite" }}>
                <polygon points="100,40 152,70 152,130 100,160 48,130 48,70" fill="url(#ap-icos)" stroke="#C7A6FF" strokeWidth="0.6" />
                <polygon points="100,40 152,70 100,100" fill="rgba(255,255,255,0.10)" />
                <polygon points="100,40 100,100 48,70" fill="rgba(0,0,0,0.20)" />
              </g>
            </svg>
          </div>
          <div className="flex md:flex-col gap-6 md:gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone">
            <span className="flex md:flex-col gap-1">
              <span className="text-bone/66">regions</span>
              <span className="text-peacock-bright">3 live</span>
            </span>
            <span className="flex md:flex-col gap-1">
              <span className="text-bone/66">arcs</span>
              <span className="text-peacock-bright">23</span>
            </span>
            <span className="flex md:flex-col gap-1">
              <span className="text-bone/66">enter</span>
              <span className="text-peacock-bright">↗</span>
            </span>
          </div>
        </div>
      </Link>

      <style jsx>{`
        @keyframes ap-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulsePeacock {
          0%, 100% {
            opacity: 0.92;
            text-shadow: 0 0 22px rgba(42, 111, 142, 0.18);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 32px rgba(42, 111, 142, 0.42);
          }
        }
        @keyframes pulsePersimmon {
          0%, 100% {
            opacity: 0.94;
            text-shadow: 0 0 22px rgba(232, 154, 44, 0.30);
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            text-shadow: 0 0 36px rgba(232, 154, 44, 0.55);
            transform: translateY(-2px);
          }
        }
      `}</style>
    </section>
  );
}
