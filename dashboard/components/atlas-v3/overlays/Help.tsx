"use client";
/* Help — keymap card centered on the field.
 *
 * Triggered by ? key, or by clicking "? help" in the bottom-left
 * keymap hints. ESC dismisses; click outside dismisses. */

import { motion, AnimatePresence } from "framer-motion";

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
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[480px] border border-ink/22 bg-cream-card shadow-xl"
          >
            <div className="flex items-baseline justify-between px-5 py-3 border-b border-ink/12">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-peacock">¶ keymap</span>
              <button
                type="button"
                onClick={() => setHelp(false)}
                className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <h2 className="font-display italic text-[28px] leading-tight text-ink/94 mb-1">
                navigate the <em className="text-persimmon">cosmos</em>.
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-5">
                mouse + keyboard reference
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
        </>
      )}
    </AnimatePresence>
  );
}
