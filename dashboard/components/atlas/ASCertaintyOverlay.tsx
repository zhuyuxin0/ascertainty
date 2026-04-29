"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * The cinematic landing overlay. Renders A S C E R T A I N T Y letter-by-
 * letter, each pulsing softly. Hovering each CERTAIN letter reveals what
 * the letter stands for. Scrolling or clicking dismisses the overlay,
 * revealing the cosmos canvas behind it.
 *
 * The "AS" prefix and "TY" suffix are stylistic accents — the meaningful
 * substrate is CERTAIN. Tooltips appear only on the seven CERTAIN letters.
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

const LETTERS = "ASCERTAINTY".split("");
const CERTAIN_RANGE: [number, number] = [2, 8]; // indices for C, E, R, T, A, I, N

export function ASCertaintyOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

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
            {/* The name */}
            <div className="flex items-baseline gap-1 sm:gap-2">
              {LETTERS.map((ch, i) => {
                const inCertain =
                  i >= CERTAIN_RANGE[0] && i <= CERTAIN_RANGE[1];
                const meaning = inCertain ? CERTAIN_MEANINGS[ch] : null;
                const isHovered = hoveredIdx === i;
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
                    onMouseEnter={() => inCertain && setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`relative font-display text-7xl sm:text-8xl md:text-9xl leading-none transition-colors ${
                      inCertain
                        ? "text-cyan cursor-help"
                        : "text-white/60"
                    } ${isHovered ? "opacity-100" : ""}`}
                    style={
                      inCertain
                        ? {
                            animation: `pulse 3s ease-in-out infinite`,
                            animationDelay: `${i * 0.18}s`,
                          }
                        : undefined
                    }
                  >
                    {ch}
                    {/* tooltip */}
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
              <p className="font-display text-xl sm:text-2xl text-white/85 italic tracking-wide">
                A <span className="text-cyan not-italic">stop</span> of{" "}
                <span className="text-cyan not-italic">certain</span>{" "}
                <span className="not-italic">to</span>{" "}
                <span className="text-cyan not-italic">you</span>.
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
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
