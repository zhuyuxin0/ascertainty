"use client";
/* Help — keymap card, draggable from header, centered on every open.
 *
 * Anatomy: header drag handle (with `⋮⋮` glyph + cursor-grab) + close
 * X. Body lists 12 keys. ESC + click-outside dismiss. Position resets
 * to center on every open so the user always finds it where expected.
 *
 * Centering: a flex grid parent positions the card; framer-motion's
 * `drag` + `useMotionValue` track the user's offset without fighting
 * Tailwind's translate centering trick. */

import { useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";

import { useAtlasV3 } from "@/lib/atlas-v3/state";

const KEYS: Array<[string, string]> = [
  ["drag", "pan the cosmos"],
  ["scroll", "zoom in / out"],
  ["click region", "enter domain band"],
  ["click sub-domain", "enter entity band"],
  ["click entity", "enter detail band · open bounty"],
  ["click persona", "spawn detail card"],
  ["click brand", "reset to cosmos"],
  ["esc", "dismiss most-recent layer"],
  ["?", "this card"],
  ["l", "draw region · stake"],
  ["⌘ k / ctrl k", "toggle library"],
  ["b", "bookmark current view"],
];

export function HelpOverlay() {
  const open = useAtlasV3((s) => s.help);
  const setHelp = useAtlasV3((s) => s.setHelp);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  // Reset to center every open
  useEffect(() => {
    if (open) {
      x.set(0);
      y.set(0);
    }
  }, [open, x, y]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(250, 246, 232, 0.8)" }}
            onClick={() => setHelp(false)}
          />
          <div className="fixed inset-0 z-[101] grid place-items-center pointer-events-none">
            <motion.div
              drag
              dragListener={false}
              dragControls={dragControls}
              dragMomentum={false}
              dragElastic={0}
              style={{ x, y }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="pointer-events-auto w-[480px] max-w-[calc(100vw-32px)] border border-ink/22 bg-cream-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex items-center justify-between px-5 py-3 border-b border-ink/12 cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: "none" }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-peacock flex items-center gap-2">
                  <span className="text-ink/46">⋮⋮</span>
                  <span>¶ keymap</span>
                </span>
                <button
                  type="button"
                  onClick={() => setHelp(false)}
                  className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
                  aria-label="close keymap"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <h2 className="font-display italic text-[28px] leading-tight text-ink/94 mb-1">
                  navigate the <em className="text-persimmon">cosmos</em>.
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-5">
                  mouse + keyboard reference · drag header to reposition
                </p>
                <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 font-mono text-[11px]">
                  {KEYS.map(([k, v]) => (
                    <div key={k} className="contents">
                      <span className="font-hash text-[12px] text-ink/94 normal-case tracking-normal border border-ink/12 bg-cream px-1.5 py-0.5 self-start">
                        {k}
                      </span>
                      <span className="text-ink/66 self-center">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
