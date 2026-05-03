"use client";
/* PanelShell — shared chrome for all v3 side-panels.
 *
 * Slides in from the right edge with a 400ms cubic-bezier spring.
 * Cream paper card on a transparent backdrop (no scrim — the cosmos
 * stays visible behind, clickable outside the panel to dismiss).
 *
 * Anatomy:
 *   header  → ordinal eyebrow (mono uppercase) + close X (top-right)
 *   body    → scrollable content
 *   footer? → optional CTA row (jade primary + ghost secondary)
 */

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

import { useAtlasV3 } from "@/lib/atlas-v3/state";

export function PanelShell({
  open,
  onClose,
  eyebrow,
  children,
  footer,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Click-outside scrim — invisible, doesn't block visual */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[40] pointer-events-auto"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed right-7 top-7 bottom-7 z-[50] flex flex-col border border-ink/22 backdrop-blur"
            style={{
              width,
              background: "rgba(253, 250, 238, 0.96)",
              boxShadow: "0 24px 80px -20px rgba(10, 21, 37, 0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-baseline justify-between px-5 py-3 border-b border-ink/12">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-peacock">
                {eyebrow}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
                aria-label="close panel"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && (
              <footer className="border-t border-ink/12 p-4 flex items-center gap-3">{footer}</footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** Common KV row used by panels. */
export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 items-baseline font-mono text-[11px]">
      <span className="text-ink/46 uppercase tracking-[0.14em] text-[9px]">{k}</span>
      <span className="text-ink/94">{v}</span>
    </div>
  );
}

/** Common section with mono eyebrow + body. */
export function Section({
  num,
  title,
  children,
}: {
  num?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-ink/12 bg-cream-card p-4 flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        {num && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-persimmon">{num}</span>
        )}
        <h3 className="font-display italic text-[16px] leading-none text-ink/94">{title}</h3>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/** Hook helper: subscribe to one panel's open-state without leaking the
 *  whole store object across renders. */
export function usePanelOpen(name: string) {
  return useAtlasV3((s) => s.panel === name);
}
