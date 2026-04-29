"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { registry, projectToScreen, type EntityRecord } from "@/lib/atlas/entityRegistry";

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
  // *** Deterministic capture from real entities. ***
  // Project every registered entity's 3D position to screen-space using
  // the live camera, then point-in-shape test against the lasso. Same
  // shape over the same region → same numbers, every time.
  const aggregate = useMemo(() => captureEntities(shape), [shape]);

  const cardWidth = 320;
  const left =
    bb.x + bb.w + cardWidth + 12 < window.innerWidth
      ? bb.x + bb.w + 12
      : Math.max(12, bb.x - cardWidth);

  const directionLabel =
    aggregate.consensus === 0
      ? "neutral"
      : aggregate.consensus > 0
        ? "long"
        : "short";
  const directionColor =
    aggregate.consensus > 0
      ? "#00d4aa"
      : aggregate.consensus < 0
        ? "#ff6b35"
        : "#9aa0b5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", damping: 22, stiffness: 240 }}
      className="absolute border border-cyan bg-bg/92 backdrop-blur p-4 w-80 pointer-events-auto"
      style={{ left, top: bb.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 mb-2">
        region selected · {shape.kind}
      </p>
      <p className="font-display text-2xl text-white mb-3">stake on this region</p>

      {aggregate.count === 0 ? (
        <div className="border border-amber/40 bg-amber/10 p-3 font-mono text-[11px] text-amber mb-4">
          no nodes captured — try a bigger region, or zoom in so entities
          are visible on screen
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <Row label="nodes captured" value={String(aggregate.count)} />
          {aggregate.byKind.model > 0 && (
            <Row
              label="ai models"
              value={`${aggregate.byKind.model}`}
              valueColor="#00d4aa"
            />
          )}
          {aggregate.byKind.market > 0 && (
            <Row
              label="markets"
              value={`${aggregate.byKind.market}`}
              valueColor="#C7A6FF"
            />
          )}
          {aggregate.byKind.bounty > 0 && (
            <Row
              label="proof bounties"
              value={`${aggregate.byKind.bounty}`}
              valueColor="#7DD3F7"
            />
          )}
          <Row
            label="avg quality"
            value={aggregate.avgScore.toFixed(1)}
          />
          <Row
            label="consensus"
            value={`${(aggregate.confidence * 100).toFixed(0)}% ${directionLabel}`}
            valueColor={directionColor}
          />
        </div>
      )}

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

/* ---------- entity capture (real, deterministic) ---------- */

type Aggregate = {
  count: number;
  byKind: { model: number; market: number; bounty: number };
  avgScore: number;
  /** -1..1 — sign indicates direction (long/short), magnitude indicates
   *  agreement among captured entities. */
  consensus: number;
  /** Magnitude of consensus, expressed as a 0..1 "confidence". */
  confidence: number;
};

function captureEntities(shape: Shape): Aggregate {
  const captured: EntityRecord[] = [];
  for (const e of registry.entities) {
    const screen = projectToScreen(e.position);
    if (!screen) continue;
    if (pointInShape(screen, shape)) captured.push(e);
  }

  if (captured.length === 0) {
    return {
      count: 0,
      byKind: { model: 0, market: 0, bounty: 0 },
      avgScore: 0,
      consensus: 0,
      confidence: 0,
    };
  }

  const byKind = { model: 0, market: 0, bounty: 0 };
  let scoreSum = 0;
  let dirSum = 0;
  let dirN = 0;
  for (const e of captured) {
    byKind[e.kind] += 1;
    scoreSum += e.score;
    if (e.direction !== 0) {
      dirSum += e.direction;
      dirN += 1;
    }
  }
  const consensus = dirN === 0 ? 0 : dirSum / dirN;
  return {
    count: captured.length,
    byKind,
    avgScore: scoreSum / captured.length,
    consensus,
    confidence: Math.abs(consensus),
  };
}

function pointInShape(p: [number, number], shape: Shape): boolean {
  const [x, y] = p;
  if (shape.kind === "rect") {
    const r = shape.rect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  if (shape.kind === "ellipse") {
    const r = shape.rect;
    if (r.w === 0 || r.h === 0) return false;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const dx = (x - cx) / (r.w / 2);
    const dy = (y - cy) / (r.h / 2);
    return dx * dx + dy * dy <= 1;
  }
  // freehand polygon — ray-casting
  const pts = shape.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0],
      yi = pts[i][1];
    const xj = pts[j][0],
      yj = pts[j][1];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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
