"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * The cinematic landing overlay. The name IS the design system:
 *
 *   AS-prefix:  the letter S after A becomes the START of a contextual
 *               word — Stop / Studio / Strategy / Symposium / STEM /
 *               Story — that re-frames the platform per audience. The
 *               extension auto-cycles every 3.5s; hover the S to see
 *               the gloss for the current word.
 *
 *   CERTAIN:    each letter maps to a product principle. Hover any of
 *               C-E-R-T-A-I-N to reveal it.
 *
 *   TY-suffix:  "to you" — the platform is plural-stakeholder; the AS
 *               extension changes for each.
 *
 * Scrolling/clicking dismisses, revealing the cosmos behind.
 */

const CERTAIN_MEANINGS: Record<string, { word: string; gloss: string }> = {
  C: { word: "Claims", gloss: "every node is a verifiable claim" },
  E: { word: "Evidence", gloss: "zoom deeper to see what backs it" },
  R: {
    word: "Resolution",
    gloss: "kernel-checked, TEE-attested, or consensus-resolved",
  },
  T: { word: "Tradeable", gloss: "every region can be staked on" },
  A: { word: "Agents", gloss: "spotters, solvers, spectators" },
  I: { word: "Information depth", gloss: "irreducible structure, layer by layer" },
  N: { word: "Navigable", gloss: "explored, not listed" },
};

// AS-prefix: the S becomes the start of one of these words. The extension
// auto-cycles; the visible name reads "A S(top) CERTAIN TY", "A S(tudio)
// CERTAIN TY", etc. The audience tag tells you which stakeholder this
// framing serves.
const AS_EXTENSIONS: Array<{ tail: string; word: string; gloss: string; audience: string }> = [
  { tail: "TOP", word: "Stop", gloss: "a place to pause, examine, verify before acting", audience: "for the analyst" },
  { tail: "TUDIO", word: "Studio", gloss: "a creative workspace for building knowledge agents", audience: "for the spotter" },
  { tail: "TRATEGY", word: "Strategy", gloss: "a decision framework grounded in verified information", audience: "for the operator" },
  { tail: "YMPOSIUM", word: "Symposium", gloss: "a gathering place for solvers, spotters, spectators", audience: "for the community" },
  { tail: "TEM", word: "STEM", gloss: "a scientific instrument for navigating knowledge", audience: "for the researcher" },
  { tail: "TORY", word: "Story", gloss: "a narrative that unfolds as you zoom deeper", audience: "for the spectator" },
];

const LETTERS = "ASCERTAINTY".split("");
const CERTAIN_RANGE: [number, number] = [2, 8]; // indices for C, E, R, T, A, I, N
const S_INDEX = 1; // index of the contextual S

export function ASCertaintyOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [sHovered, setSHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const [extIdx, setExtIdx] = useState(0);

  // Auto-cycle the AS-extension every 1.8s. Pauses on hover so users can read.
  useEffect(() => {
    if (sHovered) return;
    const iv = window.setInterval(() => {
      setExtIdx((i) => (i + 1) % AS_EXTENSIONS.length);
    }, 1800);
    return () => window.clearInterval(iv);
  }, [sHovered]);

  const ext = AS_EXTENSIONS[extIdx];

  function dismiss() {
    if (!visible) return;
    setVisible(false);
    // give exit animation a beat before unmounting
    setTimeout(onDismiss, 600);
  }

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > 5) dismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") dismiss();
    }
    function onClick() {
      dismiss();
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeOut" } }}
          className="fixed inset-0 z-50 grid place-items-center bg-bg/95 backdrop-blur-sm"
          aria-hidden={!visible}
        >
          <div className="flex flex-col items-center gap-12 select-none">
            {/* The name. Color choreography:
                  A      → white  (the "A" prefix article)
                  S      → AMBER  (the contextual word — Stop / Studio …)
                  CERTAIN→ cyan   (the substrate)
                  TY     → white  ("to you")
                The S extension renders ABOVE the S (vertically) so it
                doesn't horizontally overlap CERTAIN. */}
            <div className="flex items-baseline gap-1 sm:gap-2">
              {LETTERS.map((ch, i) => {
                const isS = i === S_INDEX;
                const inCertain =
                  i >= CERTAIN_RANGE[0] && i <= CERTAIN_RANGE[1];
                const meaning = inCertain ? CERTAIN_MEANINGS[ch] : null;
                const isHovered = hoveredIdx === i;

                let colorClass = "text-white/85"; // A and TY
                if (isS) colorClass = "text-amber";
                else if (inCertain) colorClass = "text-cyan";

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
                    className={`relative font-display text-7xl sm:text-8xl md:text-9xl leading-none ${colorClass} ${
                      inCertain || isS ? "cursor-help" : ""
                    }`}
                    style={
                      inCertain || isS
                        ? {
                            animation: isS
                              ? "pulseAmber 1.8s ease-in-out infinite"
                              : "pulse 3s ease-in-out infinite",
                            animationDelay: `${i * 0.18}s`,
                          }
                        : undefined
                    }
                  >
                    {ch}

                    {/* S extension: renders ABOVE the S as a small caption
                        that cycles in vertical sync. Doesn't push C-E-R-T-A-I-N
                        sideways. */}
                    {isS && (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={ext.tail}
                          initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          className="absolute left-1/2 -translate-x-1/2 -top-12 sm:-top-14 md:-top-16 font-display text-3xl sm:text-4xl md:text-5xl text-amber leading-none pointer-events-none whitespace-nowrap"
                          style={{ textShadow: "0 0 18px rgba(255, 107, 53, 0.55)" }}
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
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-cyan/80 pointer-events-none"
                      >
                        <span className="block text-cyan">{meaning.word}</span>
                        <span className="block text-white/50 font-sans normal-case text-[11px] mt-1">
                          {meaning.gloss}
                        </span>
                      </motion.span>
                    )}

                    {/* S tooltip — shows the current word + gloss */}
                    {isS && sHovered && (
                      <motion.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-amber pointer-events-none"
                      >
                        <span className="block text-amber">A {ext.word.toLowerCase()}</span>
                        <span className="block text-white/50 font-sans normal-case text-[11px] mt-1">
                          {ext.gloss}
                        </span>
                        <span className="block text-white/40 mt-1 text-[9px]">
                          {ext.audience}
                        </span>
                      </motion.span>
                    )}
                  </motion.span>
                );
              })}
            </div>

            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { delay: 1.2, duration: 0.8 },
              }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <p className="font-display text-xl sm:text-2xl italic tracking-wide">
                <span className="text-white/85 not-italic">A</span>{" "}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={ext.word}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.4 }}
                    className="text-amber not-italic inline-block"
                  >
                    {ext.word.toLowerCase()}
                  </motion.span>
                </AnimatePresence>{" "}
                <span className="text-white/85 not-italic">of</span>{" "}
                <span className="text-cyan not-italic">certain</span>{" "}
                <span className="text-white/85 not-italic">to</span>{" "}
                <span className="text-white/85 not-italic">you</span>
                <span className="text-white/85 not-italic">.</span>
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40 mt-4">
                information has depth · navigate it
              </p>
            </motion.div>

            {/* Scroll instruction */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { delay: 2, duration: 0.6 },
              }}
              className="absolute bottom-12 flex flex-col items-center gap-1"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                scroll · click · or press space
              </span>
              <span className="text-white/30 text-2xl animate-bounce">↓</span>
            </motion.div>
          </div>

          <style jsx>{`
            @keyframes pulse {
              0%,
              100% {
                opacity: 0.85;
                text-shadow: 0 0 20px rgba(0, 212, 170, 0.15);
              }
              50% {
                opacity: 1;
                text-shadow: 0 0 30px rgba(0, 212, 170, 0.45);
              }
            }
            @keyframes pulseAmber {
              0%,
              100% {
                opacity: 0.92;
                text-shadow: 0 0 22px rgba(255, 107, 53, 0.25);
                transform: translateY(0);
              }
              50% {
                opacity: 1;
                text-shadow: 0 0 36px rgba(255, 107, 53, 0.6);
                transform: translateY(-2px);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
