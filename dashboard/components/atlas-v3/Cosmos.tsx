"use client";
/* Cosmos — the cartographic SVG canvas of the v3 atlas.
 *
 * One <svg viewBox> covering the full field. The viewBox is computed
 * dynamically from `scale` + `viewport` in the Zustand store, so:
 *   • Scroll the cosmos → state.scale changes → viewBox shrinks → zoom in
 *   • Drag the cosmos → state.viewport changes → viewBox origin shifts → pan
 *   • Drag the minimap viewport rect → same state.viewport → pans cosmos
 *   • Drag the scale chip → same state.scale → zooms cosmos
 *
 * Click handlers on regions / personas / sub-domains check
 * `event.target === event.currentTarget` to avoid eating the drag.
 *
 * Renders:
 *   • Region wash gradients (radial fills behind each cluster)
 *   • Confidence arcs between regions (decorative, hand-tuned)
 *   • Confidence badges on the arcs (94% / 52% / 71% / 21%)
 *   • Three live regions: AI Models · Math Proofs · Prediction Markets
 *   • Three placeholder regions
 *   • Three persona dots: Andy · Carl · Bea
 *   • A semi-opaque cream overlay when band ≠ cosmos
 */

import { useRef, useState } from "react";

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { PERSONAS, PLACEHOLDERS, REGIONS, type RegionDef } from "@/lib/atlas-v3/regions";

import { DomainView } from "./bands/DomainView";
import { EntityView } from "./bands/EntityView";
import { DetailView } from "./bands/DetailView";

/** Stage-space dimensions. Matches the canonical 1600×900 from the
 *  design handoff. The actual rendered viewBox is derived from these
 *  + (scale, viewport). */
const STAGE_W = 1600;
const STAGE_H = 900;

export function Cosmos({
  modelCount,
  marketCount,
  bountyCount,
}: {
  modelCount: number;
  marketCount: number;
  bountyCount: number;
}) {
  const band = useAtlasV3((s) => s.band);
  const setBand = useAtlasV3((s) => s.setBand);
  const setRegion = useAtlasV3((s) => s.setRegion);
  const setObserve = useAtlasV3((s) => s.setObserve);
  const openPersona = useAtlasV3((s) => s.openPersona);
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);
  const pushToast = useAtlasV3((s) => s.pushToast);

  const counts: Record<RegionDef["id"], number> = {
    "ai-models": modelCount,
    "math-proofs": bountyCount,
    "prediction-markets": marketCount,
  };

  const togglePanel = useAtlasV3((s) => s.togglePanel);

  const onRegionClick = (r: RegionDef) => {
    setRegion(r.id);
    setBand("domain");
    setObserve({ kind: "region", id: r.id });
    pushToast({ glyph: "→", label: "entered domain", em: ` ${r.name}` });
    // The math-proofs region drops the user straight into the bounty
    // board on the right — domain band still shows visually, but the
    // panel surfaces the actual list since proofs are a list of items.
    if (r.id === "math-proofs") togglePanel("bounties");
  };

  const onPersonaClick = (slug: string, name: string) => {
    openPersona(slug);
    pushToast({ glyph: "⌥", label: "persona detail", em: ` ${name}` });
  };

  const tipHandlers = (label: string, body: string, keys: Array<[string, string]>) => ({
    onMouseEnter: (e: React.MouseEvent) => showTooltip({ label, body, keys }, e),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  });

  // ── Camera state: scale (zoom) + viewport (pan) drive a dynamic viewBox ──
  const scale = useAtlasV3((s) => s.scale);
  const viewport = useAtlasV3((s) => s.viewport);
  const setScale = useAtlasV3((s) => s.setScale);
  const setViewport = useAtlasV3((s) => s.setViewport);

  // Effective rendered slice of stage (smaller = zoomed in)
  const effW = STAGE_W / scale;
  const effH = STAGE_H / scale;
  // Pannable range (positive when zoomed in past 1x)
  const panRangeX = Math.max(0, STAGE_W - effW);
  const panRangeY = Math.max(0, STAGE_H - effH);
  const vbX = panRangeX * viewport.x;
  const vbY = panRangeY * viewport.y;

  // Drag-to-pan: track every mousedown anywhere on the SVG. If the
  // pointer moves > DRAG_THRESHOLD before mouseup, treat it as a pan
  // (and suppress any child onClick via the capture-phase guard
  // below). Otherwise the child onClick fires normally and the mouse-
  // down was a no-op. This pattern lets users drag from anywhere
  // INCLUDING over a region planet — they just have to commit to
  // movement to indicate intent.
  const dragRef = useRef<{ startX: number; startY: number; vx: number; vy: number; w: number; h: number; moved: boolean } | null>(null);
  const dragSuppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const DRAG_THRESHOLD = 5; // px

  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (panRangeX === 0 && panRangeY === 0) return; // nothing to pan
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      vx: viewport.x,
      vy: viewport.y,
      w: rect.width,
      h: rect.height,
      moved: false,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dxPx = ev.clientX - dragRef.current.startX;
      const dyPx = ev.clientY - dragRef.current.startY;
      if (!dragRef.current.moved && Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD) return;
      if (!dragRef.current.moved) {
        dragRef.current.moved = true;
        setDragging(true);
      }
      // Pixel delta → viewport delta, inverted (drag right pans cosmos
      // right, so visible content moves left). Scale by panRange so
      // dragging all the way across the canvas pans the full range.
      const dvx = -dxPx / dragRef.current.w;
      const dvy = -dyPx / dragRef.current.h;
      setViewport({
        x: Math.max(0, Math.min(1, dragRef.current.vx + dvx)),
        y: Math.max(0, Math.min(1, dragRef.current.vy + dvy)),
      });
    };
    const onUp = () => {
      const wasDrag = dragRef.current?.moved ?? false;
      dragRef.current = null;
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (wasDrag) {
        // Suppress the impending click event on whichever child the
        // user happened to land on. Resets after one event tick.
        dragSuppressClick.current = true;
        window.setTimeout(() => {
          dragSuppressClick.current = false;
        }, 0);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Capture-phase click guard — if the previous mouseup ended a real
  // drag, swallow the resulting click before any region/persona handler
  // sees it.
  const onSvgClickCapture = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragSuppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // Scroll-to-zoom. Anchors zoom near the cursor for natural feel.
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault?.();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const next = Math.max(0.4, Math.min(3.6, scale * factor));
    setScale(next);
  };

  return (
    <div className="absolute inset-0 z-[2]">
      <svg
        viewBox={`${vbX} ${vbY} ${effW} ${effH}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        style={{
          display: "block",
          cursor: dragging ? "grabbing" : panRangeX > 0 || panRangeY > 0 ? "grab" : "default",
          transition: dragging ? "none" : "all 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onMouseDown={onSvgMouseDown}
        onClickCapture={onSvgClickCapture}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="hatch-ash" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(10,21,37,0.06)" strokeWidth="1" />
          </pattern>
          {REGIONS.map((r) => (
            <radialGradient key={r.id} id={`zone-${r.id}`} cx="50%" cy="50%">
              <stop offset="0%" stopColor={r.color} stopOpacity="0.08" />
              <stop offset="70%" stopColor={r.color} stopOpacity="0.03" />
              <stop offset="100%" stopColor={r.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Region wash backgrounds (paper ink zones, not glows) */}
        {REGIONS.map((r) => (
          <circle
            key={`wash-${r.id}`}
            cx={r.cx}
            cy={r.cy}
            r={r.haloR + 60}
            fill={`url(#zone-${r.id})`}
            opacity={0.8}
          />
        ))}

        {/* Confidence arcs between regions — ink curves on paper */}
        <path d="M 1100 280 Q 1240 480 1280 720" fill="none" stroke="rgba(10,21,37,0.18)" strokeWidth="1.2" />
        <path d="M 1100 280 Q 1180 540 1280 720" fill="none" stroke="rgba(199,106,43,0.25)" strokeWidth="0.9" />
        <path d="M 1100 280 Q 760 380 540 600" fill="none" stroke="rgba(10,21,37,0.14)" strokeWidth="1.0" />
        <path d="M 540 600 Q 900 720 1280 720" fill="none" stroke="rgba(10,21,37,0.08)" strokeWidth="0.7" strokeDasharray="3 5" />

        {/* Confidence badges along the arcs */}
        <g fontFamily="JetBrains Mono" fontSize="9" fontWeight={500} letterSpacing={1}>
          <ArcBadge x={1182} y={488} val="94%" stroke="rgba(10,21,37,0.22)" fill="rgba(10,21,37,0.66)" />
          <ArcBadge x={1162} y={418} val="52%" stroke="rgba(199,106,43,0.35)" fill="#C76A2B" />
          <ArcBadge x={780}  y={428} val="71%" stroke="rgba(10,21,37,0.14)" fill="rgba(10,21,37,0.46)" />
          <ArcBadge x={900}  y={698} val="21%" stroke="rgba(10,21,37,0.10)" fill="rgba(10,21,37,0.26)" />
        </g>

        {/* Live regions */}
        {REGIONS.map((r) => (
          <g
            key={r.id}
            style={{ cursor: "pointer" }}
            onClick={() => onRegionClick(r)}
            {...tipHandlers(
              `region · ${r.name.toLowerCase()}`,
              `${counts[r.id]} ${r.unit.toLowerCase()} · ${r.subtitle}. Click to enter the ${r.name} domain.`,
              [["click", "band → domain"]],
            )}
          >
            <circle cx={r.cx} cy={r.cy} r={r.innerR} fill={`${r.color}0A`} />
            <circle
              cx={r.cx}
              cy={r.cy}
              r={r.innerR - 30}
              fill="none"
              stroke={`${r.color}33`}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <RegionGlyph cx={r.cx} cy={r.cy} shape={r.shape} color={r.color} />
            <text
              x={r.cx}
              y={r.cy + r.innerR / 2 + 60}
              textAnchor="middle"
              fontFamily="var(--font-instrument-serif), serif"
              fontStyle="italic"
              fontSize={r.id === "ai-models" ? 22 : 20}
              fill="rgba(10,21,37,0.94)"
              letterSpacing="-0.3"
            >
              {r.name}
            </text>
            <text
              x={r.cx}
              y={r.cy + r.innerR / 2 + 78}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={9}
              fill={r.color}
              letterSpacing={2.5}
            >
              {counts[r.id]} {r.unit} · LIVE
            </text>
          </g>
        ))}

        {/* Placeholder regions — ash-hatch fill, not interactive */}
        {PLACEHOLDERS.map((p) => (
          <g
            key={p.id}
            opacity={0.5}
            style={{ cursor: "not-allowed" }}
            {...tipHandlers(
              "pre-region · placeholder",
              `${p.when} expansion · not navigable yet.`,
              [["hover", "cursor: not-allowed"], ["click", "no-op"]],
            )}
          >
            <circle cx={p.cx} cy={p.cy} r={p.r} fill="url(#hatch-ash)" stroke="rgba(10,21,37,0.08)" strokeWidth={0.5} />
            <text
              x={p.cx}
              y={p.cy + 6}
              textAnchor="middle"
              fontFamily="var(--font-instrument-serif), serif"
              fontStyle="italic"
              fontSize={13}
              fill="rgba(10,21,37,0.30)"
            >
              {p.name}
            </text>
            <text
              x={p.cx}
              y={p.cy + 22}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={8}
              fill="rgba(199,106,43,0.50)"
              letterSpacing={2}
            >
              {p.when}
            </text>
          </g>
        ))}

        {/* Personas — wandering dots */}
        {PERSONAS.map((p) => (
          <g
            key={p.slug}
            transform={`translate(${p.x}, ${p.y})`}
            style={{ cursor: "pointer" }}
            onClick={() => onPersonaClick(p.slug, p.short)}
            {...tipHandlers(
              `persona · ${p.short.toLowerCase()}`,
              `${p.short[0]}${p.short.slice(1).toLowerCase()} — click to spawn detail card.`,
              [["click", "persona detail card opens"]],
            )}
          >
            <circle r={14} fill="rgba(250,246,232,0.9)" stroke={p.color} strokeWidth={1} />
            <text x={0} y={5} textAnchor="middle" fontSize={12}>
              {p.emoji}
            </text>
            <text
              x={0}
              y={26}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={7}
              fill={p.color}
              letterSpacing={1.5}
            >
              {p.short}
            </text>
          </g>
        ))}

        {/* Cream scrim when band ≠ cosmos — lifts the band-view onto the
            cosmos backdrop. 0.78 alpha so the cosmos color/motion still
            bleeds through faintly per the v3 README anti-modal-trap rule. */}
        {band !== "cosmos" && (
          <rect x={0} y={0} width={1600} height={900} fill="rgba(250,246,232,0.78)" pointerEvents="none" />
        )}

        {band === "domain" && <DomainView />}
        {band === "entity" && <EntityView />}
        {band === "detail" && <DetailView />}
      </svg>
    </div>
  );
}

function ArcBadge({ x, y, val, stroke, fill }: { x: number; y: number; val: string; stroke: string; fill: string }) {
  return (
    <>
      <rect x={x} y={y} width={36} height={16} fill="#FAF6E8" stroke={stroke} strokeWidth={0.6} />
      <text x={x + 18} y={y + 12} textAnchor="middle" fill={fill}>
        {val}
      </text>
    </>
  );
}

function RegionGlyph({ cx, cy, shape, color }: { cx: number; cy: number; shape: RegionDef["shape"]; color: string }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {shape === "hexagon" && (
        <>
          <polygon
            points="0,-32 28,-16 28,16 0,32 -28,16 -28,-16"
            fill={`${color}14`}
            stroke={color}
            strokeWidth={1.2}
          />
          <line x1={0} y1={-32} x2={0} y2={32} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <line x1={-28} y1={-16} x2={28} y2={16} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <line x1={28} y1={-16} x2={-28} y2={16} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <circle cx={0} cy={0} r={3} fill={color} opacity={0.5} />
        </>
      )}
      {shape === "diamond" && (
        <>
          <polygon points="0,-28 24,0 0,28 -24,0" fill={`${color}14`} stroke={color} strokeWidth={1.2} />
          <line x1={0} y1={-28} x2={0} y2={28} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <line x1={-24} y1={0} x2={24} y2={0} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <circle cx={0} cy={0} r={2.5} fill={color} opacity={0.5} />
        </>
      )}
      {shape === "octagon" && (
        <>
          <polygon
            points="-10,-30 10,-30 30,-10 30,10 10,30 -10,30 -30,10 -30,-10"
            fill={`${color}14`}
            stroke={color}
            strokeWidth={1.2}
          />
          <line x1={0} y1={-30} x2={0} y2={30} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <line x1={-30} y1={0} x2={30} y2={0} stroke={color} strokeWidth={0.5} opacity={0.4} />
          <rect x={-3} y={-3} width={6} height={6} fill={color} opacity={0.4} transform="rotate(45)" />
        </>
      )}
    </g>
  );
}
