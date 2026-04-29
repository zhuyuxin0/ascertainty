"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Screen-space region lasso for staking, with three shape modes:
 *   - rect:     drag a rectangle (axis-aligned)
 *   - ellipse:  drag a bounding box, render the inscribed ellipse
 *   - freehand: trace a closed path with the cursor (sampled mouse path)
 *
 * The committed shape stores its raw geometry so we can re-render it as
 * the persistent selection outline AND compute a sensible card-anchor
 * rect from its bounding box. Region staking on-chain is deferred —
 * this component sells the *idea* visually so the demo flow has the
 * beat without the wiring.
 */

type Rect = { x: number; y: number; w: number; h: number };
type Pt = [number, number];

type ShapeMode = "rect" | "ellipse" | "freehand";

type Shape =
  | { kind: "rect"; rect: Rect }
  | { kind: "ellipse"; rect: Rect }
  | { kind: "freehand"; points: Pt[] };

export function RegionLasso({
  active,
  onDeactivate,
}: {
  active: boolean;
  onDeactivate: () => void;
}) {
  const [mode, setMode] = useState<ShapeMode>("rect");
  const [drag, setDrag] = useState<Shape | null>(null);
  const [committed, setCommitted] = useState<Shape | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const freehandRef = useRef<Pt[]>([]);

  if (!active) return null;

  function handleDown(e: React.PointerEvent) {
    setCommitted(null);
    startRef.current = { x: e.clientX, y: e.clientY };
    if (mode === "freehand") {
      freehandRef.current = [[e.clientX, e.clientY]];
      setDrag({ kind: "freehand", points: [...freehandRef.current] });
    } else {
      setDrag({
        kind: mode,
        rect: { x: e.clientX, y: e.clientY, w: 0, h: 0 },
      });
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handleMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    if (mode === "freehand") {
      // Throttle by minimum-distance: skip if last point is too close
      const last = freehandRef.current[freehandRef.current.length - 1];
      const dx = e.clientX - last[0];
      const dy = e.clientY - last[1];
      if (dx * dx + dy * dy < 9) return; // ~3px threshold
      freehandRef.current.push([e.clientX, e.clientY]);
      setDrag({ kind: "freehand", points: [...freehandRef.current] });
      return;
    }
    const sx = startRef.current.x;
    const sy = startRef.current.y;
    setDrag({
      kind: mode,
      rect: {
        x: Math.min(sx, e.clientX),
        y: Math.min(sy, e.clientY),
        w: Math.abs(e.clientX - sx),
        h: Math.abs(e.clientY - sy),
      },
    });
  }

  function handleUp() {
    if (drag) {
      const bb = boundingRect(drag);
      if (bb.w > 12 && bb.h > 12) {
        setCommitted(drag);
      }
    }
    setDrag(null);
    startRef.current = null;
    freehandRef.current = [];
  }

  function reset() {
    setCommitted(null);
    setDrag(null);
    startRef.current = null;
    freehandRef.current = [];
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

      {/* Tool picker — top-center, while no selection drawn */}
      {!drag && !committed && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 border border-cyan/60 bg-bg/85 backdrop-blur px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan flex items-center gap-3">
          <ToolButton
            label="rect"
            glyph="▭"
            active={mode === "rect"}
            onClick={() => setMode("rect")}
            title="rectangle (drag corner-to-corner)"
          />
          <ToolButton
            label="ellipse"
            glyph="◯"
            active={mode === "ellipse"}
            onClick={() => setMode("ellipse")}
            title="ellipse (drag a bounding box)"
          />
          <ToolButton
            label="freehand"
            glyph="✎"
            active={mode === "freehand"}
            onClick={() => setMode("freehand")}
            title="freehand (trace any shape)"
          />
          <span className="text-white/30 mx-1">·</span>
          <span className="text-white/60 normal-case tracking-normal">
            drag to define a region
          </span>
          <button
            type="button"
            onClick={onDeactivate}
            className="text-white/40 hover:text-white text-base leading-none ml-1"
            aria-label="cancel lasso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live drag preview */}
      {drag && <ShapeOverlay shape={drag} />}

      {/* Committed selection + StakeCard */}
      <AnimatePresence>
        {committed && (
          <>
            <ShapeOverlay shape={committed} />
            <StakeCard
              bb={boundingRect(committed)}
              shape={committed}
              onDismiss={() => {
                reset();
                onDeactivate();
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- shape rendering ---------- */

function ShapeOverlay({ shape }: { shape: Shape }) {
  if (shape.kind === "rect") {
    const { x, y, w, h } = shape.rect;
    return (
      <div
        className="absolute border border-cyan bg-cyan/10 pointer-events-none"
        style={{ left: x, top: y, width: w, height: h }}
      />
    );
  }
  if (shape.kind === "ellipse") {
    const { x, y, w, h } = shape.rect;
    return (
      <svg
        className="absolute pointer-events-none"
        style={{ left: x, top: y, width: w, height: h, overflow: "visible" }}
      >
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          stroke="#00D4AA"
          strokeWidth={1.4}
          fill="rgba(0,212,170,0.10)"
        />
      </svg>
    );
  }
  // freehand
  const pts = shape.points;
  if (pts.length < 2) return null;
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") + " Z";
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: "visible" }}
    >
      <path
        d={d}
        stroke="#00D4AA"
        strokeWidth={1.4}
        fill="rgba(0,212,170,0.10)"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function boundingRect(shape: Shape): Rect {
  if (shape.kind === "rect" || shape.kind === "ellipse") return shape.rect;
  const pts = shape.points;
  if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = pts[0][0],
    minY = pts[0][1],
    maxX = pts[0][0],
    maxY = pts[0][1];
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ---------- tool button ---------- */

function ToolButton({
  label,
  glyph,
  active,
  onClick,
  title,
}: {
  label: string;
  glyph: string;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 border px-2 py-1 transition-colors ${
        active
          ? "border-cyan bg-cyan/15 text-cyan"
          : "border-line text-white/50 hover:border-cyan/60 hover:text-cyan"
      }`}
    >
      <span className="text-base leading-none">{glyph}</span>
      <span>{label}</span>
    </button>
  );
}

/* ---------- stake card ---------- */

function StakeCard({
  bb,
  shape,
  onDismiss,
}: {
  bb: Rect;
  shape: Shape;
  onDismiss: () => void;
}) {
  // Aggregate metric: stable-looking from bounding box + shape kind
  const seed =
    (bb.x + bb.y * 0.31 + bb.w * bb.h * 0.0007 + shape.kind.length * 13.7) % 1;
  const direction: "long" | "short" = seed > 0.5 ? "long" : "short";
  const confidence = 0.42 + ((seed * 17) % 0.46);
  const nodeCount = Math.max(2, Math.floor((bb.w * bb.h) / 14000));
  const avgScore = 60 + ((seed * 31) % 30);

  const cardWidth = 308;
  const left =
    bb.x + bb.w + cardWidth + 12 < window.innerWidth
      ? bb.x + bb.w + 12
      : Math.max(12, bb.x - cardWidth);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="absolute border border-cyan bg-bg/92 backdrop-blur p-4 w-72 pointer-events-auto"
      style={{ left, top: bb.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 mb-2">
        region selected · {shape.kind}
      </p>
      <p className="font-display text-2xl text-white mb-3">stake on this region</p>

      <div className="space-y-2 mb-4">
        <Row label="nodes captured" value={String(nodeCount)} />
        <Row label="avg quality" value={avgScore.toFixed(1)} />
        <Row
          label="consensus"
          value={`${(confidence * 100).toFixed(0)}% ${direction}`}
          valueColor={direction === "long" ? "#00d4aa" : "#ff6b35"}
        />
      </div>

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
        onClick={onDismiss}
        className="w-full mt-2 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
      >
        dismiss
      </button>
    </motion.div>
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
      <span className="tabular-nums" style={{ color: valueColor ?? "#fff" }}>
        {value}
      </span>
    </div>
  );
}
