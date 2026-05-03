"use client";
/* Lasso — region-draw overlay with three shape modes.
 *
 * Activated by the bottom-center "draw region · stake" CTA, by `l`,
 * or by the demo-bar lasso button. Renders a transparent layer over
 * the cosmos with a `crosshair` cursor and a top-center mode-toggle:
 *
 *   rect      drag a rectangle (axis-aligned)
 *   ellipse   drag a bounding box, render the inscribed ellipse
 *   freehand  trace a closed path with the cursor (sampled mouse path)
 *
 * Mousedown + drag draws; on release the shape commits and a
 * StakeSheet anchors near it. ESC dismisses. Click the dismiss chip
 * to exit. */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useAtlasV3 } from "@/lib/atlas-v3/state";

type Pt = [number, number];
type ShapeMode = "rect" | "ellipse" | "freehand";

type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "ellipse"; x: number; y: number; w: number; h: number }
  | { kind: "freehand"; points: Pt[] };

function shapeBounds(s: Shape): { x: number; y: number; w: number; h: number } {
  if (s.kind === "rect" || s.kind === "ellipse") return { x: s.x, y: s.y, w: s.w, h: s.h };
  // freehand: bounding box of points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of s.points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function LassoOverlay() {
  const active = useAtlasV3((s) => s.lasso);
  const setLasso = useAtlasV3((s) => s.setLasso);
  const setStake = useAtlasV3((s) => s.setStake);
  const stake = useAtlasV3((s) => s.stake);
  const pushToast = useAtlasV3((s) => s.pushToast);

  const [mode, setMode] = useState<ShapeMode>("rect");
  const [drag, setDrag] = useState<Shape | null>(null);
  const freehandRef = useRef<Pt[]>([]);

  useEffect(() => {
    if (!active) {
      setDrag(null);
      freehandRef.current = [];
    }
  }, [active]);

  if (!active && !stake) return null;

  const onMouseDown = (e: React.MouseEvent) => {
    const start = { x: e.clientX, y: e.clientY };
    if (mode === "freehand") {
      freehandRef.current = [[start.x, start.y]];
      setDrag({ kind: "freehand", points: [...freehandRef.current] });
    } else {
      setDrag({ kind: mode, x: start.x, y: start.y, w: 0, h: 0 });
    }
    const onMove = (ev: MouseEvent) => {
      if (mode === "freehand") {
        // Sample at most every 4 pixels so the path stays smooth without
        // overflowing memory on long traces
        const last = freehandRef.current[freehandRef.current.length - 1];
        if (!last || Math.hypot(ev.clientX - last[0], ev.clientY - last[1]) > 4) {
          freehandRef.current.push([ev.clientX, ev.clientY]);
          setDrag({ kind: "freehand", points: [...freehandRef.current] });
        }
      } else {
        setDrag({
          kind: mode,
          x: Math.min(start.x, ev.clientX),
          y: Math.min(start.y, ev.clientY),
          w: Math.abs(ev.clientX - start.x),
          h: Math.abs(ev.clientY - start.y),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const committedShape: Shape | null =
        mode === "freehand"
          ? freehandRef.current.length > 4
            ? { kind: "freehand", points: [...freehandRef.current] }
            : null
          : (() => {
              const d = drag;
              if (!d || d.kind === "freehand") return null;
              return d.w > 24 && d.h > 24 ? d : null;
            })();
      if (committedShape) {
        const bounds = shapeBounds(committedShape);
        setLasso(false);
        setStake({ x: bounds.x + bounds.w + 16, y: Math.max(80, bounds.y - 8) });
        pushToast({ glyph: "⬚", label: "region committed", em: ` ${committedShape.kind}` });
      } else {
        setDrag(null);
        freehandRef.current = [];
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {active && (
        <div
          className="fixed inset-0 z-[80] pointer-events-auto"
          style={{ cursor: "crosshair", background: "rgba(31,143,168,0.04)" }}
          onMouseDown={onMouseDown}
        >
          {/* Top-center: shape-mode toggle */}
          <div className="absolute top-[80px] left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto bg-cream-card border border-ink/22 px-2 py-1.5 select-none">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink/46 px-2">shape</span>
            {(["rect", "ellipse", "freehand"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMode(m);
                }}
                className={`relative font-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 cursor-pointer transition-all ${
                  mode === m
                    ? "text-peacock border border-peacock"
                    : "text-ink/46 hover:text-ink/94"
                }`}
                style={mode === m ? { background: "rgba(31,143,168,0.08)" } : undefined}
              >
                {m === "rect" ? "▭" : m === "ellipse" ? "○" : "↶"} {m}
              </button>
            ))}
          </div>

          {/* Top-right: dismiss */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLasso(false);
            }}
            className="absolute top-[80px] right-7 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/66 hover:text-rose bg-cream-card border border-ink/22 px-3 py-1.5 cursor-pointer transition-colors"
          >
            ✕ dismiss
          </button>

          {/* Top-left: helper text */}
          <div className="absolute top-[140px] left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/46 select-none">
            drag to draw · esc to dismiss
          </div>

          {/* Active draw */}
          {drag && (
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              {drag.kind === "rect" && drag.w > 0 && drag.h > 0 && (
                <rect
                  x={drag.x}
                  y={drag.y}
                  width={drag.w}
                  height={drag.h}
                  fill="rgba(31,143,168,0.06)"
                  stroke="var(--peacock)"
                  strokeWidth={1}
                />
              )}
              {drag.kind === "ellipse" && drag.w > 0 && drag.h > 0 && (
                <ellipse
                  cx={drag.x + drag.w / 2}
                  cy={drag.y + drag.h / 2}
                  rx={drag.w / 2}
                  ry={drag.h / 2}
                  fill="rgba(31,143,168,0.06)"
                  stroke="var(--peacock)"
                  strokeWidth={1}
                />
              )}
              {drag.kind === "freehand" && drag.points.length > 1 && (
                <path
                  d={
                    "M " +
                    drag.points.map(([x, y]) => `${x},${y}`).join(" L ") +
                    " Z"
                  }
                  fill="rgba(31,143,168,0.06)"
                  stroke="var(--peacock)"
                  strokeWidth={1}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}
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
              left: Math.min(stake.x, (typeof window !== "undefined" ? window.innerWidth : 1600) - 320),
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
