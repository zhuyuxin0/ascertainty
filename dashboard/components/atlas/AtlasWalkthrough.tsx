"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * First-visit walkthrough.
 *
 * Four steps that explain the cosmos in plain language. Triggered when
 * `localStorage.atlas_walkthrough_seen` is unset. The user can skip at
 * any step (the skip persists the same flag), so they never see this
 * twice. The walkthrough doesn't gate the canvas — clicking outside the
 * tooltip dims it but interaction still works behind a low-z surface.
 *
 * The arc step explicitly explains the cross-domain edges so the
 * "shining amber/cyan lines" between AI Models and Prediction Markets
 * have a clear meaning rather than reading as decoration.
 */

const STORAGE_KEY = "atlas_walkthrough_seen";

type Step = {
  title: string;
  body: string;
  position:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  highlight?: { selector: string; pad?: number };
};

const STEPS: Step[] = [
  {
    title: "Welcome to the cosmos",
    body: "Each glowing planet is a domain of verifiable claims — math proofs, AI benchmarks, prediction markets. Drag to rotate, scroll to zoom, ⌘/ctrl-drag to pan.",
    position: "center",
  },
  {
    title: "Zoom bands",
    body: "Zoom in to see individual artefacts inside a region: model nodes, market questions, theorem bounties. The breadcrumb at top-left tells you which band you are in. Lock a band to roam without changing zoom level.",
    position: "top-left",
  },
  {
    title: "Cross-domain arcs",
    body: "The glowing arcs between regions are connections — a market like 'Will Claude beat GPT-5 on this benchmark?' arcs from the Markets region to the relevant model nodes. Cyan = consensus, amber = uncertain. Particles drift along the arc to show direction of inference.",
    position: "center",
  },
  {
    title: "Make your mark",
    body: "Mint a minion NFT to enter the platform as a Spotter, Solver, or Spectator. Reputation grows as your minion contributes verified work. Click the library tab at the bottom to mint.",
    position: "bottom-center",
  },
];

export function AtlasWalkthrough() {
  const [stepIdx, setStepIdx] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
  }

  function next() {
    if (stepIdx >= STEPS.length - 1) {
      dismiss();
    } else {
      setStepIdx(stepIdx + 1);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Soft scrim — dims canvas a bit but stays clickable so the
              user can still rotate the cosmos behind the tooltip. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/45 pointer-events-none"
          />

          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            className={`fixed z-40 pointer-events-auto border border-cyan/60 bg-panel/95 backdrop-blur p-5 w-[400px] max-w-[92vw] ${positionClasses(STEPS[stepIdx].position)}`}
            style={{
              boxShadow:
                "0 24px 80px -20px rgba(0,212,170,0.35), 0 0 0 1px rgba(0,212,170,0.18)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
                walkthrough · {stepIdx + 1} / {STEPS.length}
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
              >
                skip
              </button>
            </div>
            <p className="font-display text-2xl text-white mb-3 leading-tight">
              {STEPS[stepIdx].title}
            </p>
            <p className="font-mono text-[12px] text-white/70 leading-relaxed mb-4">
              {STEPS[stepIdx].body}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-6 transition-colors ${
                      i === stepIdx
                        ? "bg-cyan"
                        : i < stepIdx
                          ? "bg-cyan/40"
                          : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={next}
                className="font-mono text-[11px] uppercase tracking-widest border border-cyan text-cyan px-4 py-1.5 hover:bg-cyan hover:text-bg transition-colors"
              >
                {stepIdx >= STEPS.length - 1 ? "let's go ↗" : "next →"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function positionClasses(p: Step["position"]): string {
  switch (p) {
    case "top-left":
      return "top-20 left-6";
    case "top-right":
      return "top-20 right-6";
    case "bottom-left":
      return "bottom-24 left-6";
    case "bottom-right":
      return "bottom-24 right-6";
    case "bottom-center":
      return "bottom-24 left-1/2 -translate-x-1/2";
    case "center":
    default:
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}
