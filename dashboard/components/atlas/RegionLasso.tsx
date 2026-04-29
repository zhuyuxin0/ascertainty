"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Screen-space rectangle lasso for region staking.
 *
 * The user enters lasso mode via the HUD's "draw region" button. While
 * `active` is true, this component captures pointer events on top of the
 * canvas, draws a translucent selection rectangle, and on release shows
 * a floating StakeCard with a fabricated aggregate metric and a
 * "stake — coming soon" CTA. The on-chain stake contract is deferred
 * post-hackathon (see plan); this component sells the *idea* of region
 * staking visually so the demo flow has the beat without the wiring.
 */

type Rect = { x: number; y: number; w: number; h: number };

export function RegionLasso({
  active,
  onDeactivate,
}: {
  active: boolean;
  onDeactivate: () => void;
}) {
  const [drag, setDrag] = useState<Rect | null>(null);
  const [committed, setCommitted] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  if (!active) return null;

  function handleDown(e: React.PointerEvent) {
    setCommitted(null);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handleMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    const sx = startRef.current.x;
    const sy = startRef.current.y;
    setDrag({
      x: Math.min(sx, e.clientX),
      y: Math.min(sy, e.clientY),
      w: Math.abs(e.clientX - sx),
      h: Math.abs(e.clientY - sy),
    });
  }

  function handleUp() {
    if (drag && drag.w > 12 && drag.h > 12) {
      setCommitted(drag);
    }
    setDrag(null);
    startRef.current = null;
  }

  // Fabricate a stable-looking aggregate metric from the rectangle's
  // size + position so re-drawing produces "different" numbers.
  function aggregate(r: Rect) {
    const area = r.w * r.h;
    const seed = (r.x + r.y * 0.31 + area * 0.0007) % 1;
    const direction: "long" | "short" = seed > 0.5 ? "long" : "short";
    const confidence = 0.42 + (seed * 17) % 0.46; // 0.42..0.88
    const nodeCount = Math.max(2, Math.floor(area / 14000));
    return {
      direction,
      confidence,
      nodeCount,
      avgScore: 60 + (seed * 31) % 30,
    };
  }

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto">
      {/* Capture surface */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />

      {/* Lasso prompt — top-center while no selection drawn */}
      {!drag && !committed && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 border border-cyan/60 bg-bg/85 backdrop-blur px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-cyan flex items-center gap-3">
          <span>drag a rectangle to define a region</span>
          <button
            type="button"
            onClick={onDeactivate}
            className="text-white/40 hover:text-white text-base leading-none"
            aria-label="cancel lasso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live drag rectangle */}
      {drag && (
        <div
          className="absolute border border-cyan bg-cyan/10 pointer-events-none"
          style={{
            left: drag.x,
            top: drag.y,
            width: drag.w,
            height: drag.h,
          }}
        />
      )}

      {/* Committed selection + StakeCard */}
      <AnimatePresence>
        {committed && (
          <>
            {/* Selection outline persists */}
            <div
              className="absolute border border-cyan bg-cyan/10 pointer-events-none"
              style={{
                left: committed.x,
                top: committed.y,
                width: committed.w,
                height: committed.h,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", damping: 22, stiffness: 240 }}
              className="absolute border border-cyan bg-bg/92 backdrop-blur p-4 w-72 pointer-events-auto"
              style={{
                // Position to right of selection if there's room, else left
                left:
                  committed.x + committed.w + 308 < window.innerWidth
                    ? committed.x + committed.w + 12
                    : Math.max(12, committed.x - 308),
                top: committed.y,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 mb-2">
                region selected
              </p>
              <p className="font-display text-2xl text-white mb-3">
                stake on this region
              </p>

              {(() => {
                const a = aggregate(committed);
                return (
                  <div className="space-y-2 mb-4">
                    <Row
                      label="nodes captured"
                      value={String(a.nodeCount)}
                    />
                    <Row
                      label="avg quality"
                      value={a.avgScore.toFixed(1)}
                    />
                    <Row
                      label="consensus"
                      value={`${(a.confidence * 100).toFixed(0)}% ${a.direction}`}
                      valueColor={a.direction === "long" ? "#00d4aa" : "#ff6b35"}
                    />
                  </div>
                );
              })()}

              <button
                type="button"
                disabled
                className="w-full border border-cyan/40 text-cyan/60 px-4 py-2 font-mono text-[11px] uppercase tracking-widest cursor-not-allowed"
                title="region staking ships post-hackathon"
              >
                stake · coming soon
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommitted(null);
                  onDeactivate();
                }}
                className="w-full mt-2 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
              >
                dismiss
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[11px]">
      <span className="text-white/40 uppercase tracking-widest text-[9px]">
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{ color: valueColor ?? "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}
