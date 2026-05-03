"use client";
/* Lasso — region-draw overlay.
 *
 * Activated by the bottom-center "draw region · stake" CTA, by `l`,
 * or by the demo-bar lasso button. Renders a transparent layer over
 * the cosmos with `cursor: crosshair`. Mousedown + drag draws a
 * rectangle; on release the rectangle commits and a StakeSheet
 * anchors near it.
 *
 * On commit we don't actually stake — it's a designed flow that the
 * v3 README marks as "stake · coming soon". The visual conveys the
 * affordance. */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useAtlasV3 } from "@/lib/atlas-v3/state";

type Rect = { x: number; y: number; w: number; h: number };

export function LassoOverlay() {
  const active = useAtlasV3((s) => s.lasso);
  const setLasso = useAtlasV3((s) => s.setLasso);
  const setStake = useAtlasV3((s) => s.setStake);
  const stake = useAtlasV3((s) => s.stake);
  const pushToast = useAtlasV3((s) => s.pushToast);

  const [drag, setDrag] = useState<Rect | null>(null);

  useEffect(() => {
    if (!active) setDrag(null);
  }, [active]);

  if (!active && !stake) return null;

  const onMouseDown = (e: React.MouseEvent) => {
    setDrag({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    const start = { x: e.clientX, y: e.clientY };
    const onMove = (ev: MouseEvent) => {
      setDrag({
        x: Math.min(start.x, ev.clientX),
        y: Math.min(start.y, ev.clientY),
        w: Math.abs(ev.clientX - start.x),
        h: Math.abs(ev.clientY - start.y),
      });
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const w = Math.abs(ev.clientX - start.x);
      const h = Math.abs(ev.clientY - start.y);
      if (w > 24 && h > 24) {
        // commit
        setLasso(false);
        setStake({
          x: Math.min(start.x, ev.clientX) + w + 16,
          y: Math.min(start.y, ev.clientY) - 8,
        });
        pushToast({ glyph: "⬚", label: "region committed" });
      } else {
        setDrag(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {/* Active draw layer */}
      {active && (
        <div
          className="fixed inset-0 z-[80] pointer-events-auto"
          style={{ cursor: "crosshair", background: "rgba(31,143,168,0.04)" }}
          onMouseDown={onMouseDown}
        >
          {/* Persistent help text top-center */}
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/66 bg-cream-card border border-ink/12 px-3 py-1.5 select-none">
            draw a region · esc to dismiss
          </div>
          {/* Drag rect */}
          {drag && drag.w > 0 && drag.h > 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: drag.x,
                top: drag.y,
                width: drag.w,
                height: drag.h,
                border: "1px solid var(--peacock)",
                background: "rgba(31,143,168,0.06)",
              }}
            />
          )}
          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setLasso(false)}
            className="absolute top-[80px] right-7 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/66 hover:text-rose bg-cream-card border border-ink/22 px-3 py-1.5 cursor-pointer transition-colors"
          >
            ✕ dismiss
          </button>
        </div>
      )}

      {/* Stake card after commit */}
      <AnimatePresence>
        {stake && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            className="fixed z-[90] w-[300px] border border-peacock/60 bg-cream-card shadow-xl"
            style={{
              left: Math.min(stake.x, window.innerWidth - 320),
              top: Math.max(80, stake.y),
              background: "rgba(253, 250, 238, 0.98)",
            }}
          >
            <div className="flex items-baseline justify-between px-4 py-2.5 border-b border-ink/12">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-peacock">
                ⬚ stake on this region
              </span>
              <button
                type="button"
                onClick={() => setStake(null)}
                className="font-mono text-[14px] text-ink/46 hover:text-ink/94 leading-none cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <p className="font-display italic text-[18px] leading-tight text-ink/94 mb-3">
                3 entities enclosed — <em className="text-persimmon">multi-domain</em> stake.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                <Row k="bounties" v="2" />
                <Row k="markets" v="1" />
                <Row k="confidence" v="68%" />
                <Row k="window" v="14d" />
              </div>
              <button
                type="button"
                onClick={() => {
                  pushToast({ glyph: "⬚", label: "stake · coming soon" });
                  setStake(null);
                }}
                className="w-full border border-peacock/60 bg-peacock text-cream-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-peacock-bright transition-colors cursor-pointer"
              >
                stake · coming soon
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span>{k}</span>
      <span className="font-display text-[16px] tracking-normal normal-case text-ink/94">{v}</span>
    </div>
  );
}
