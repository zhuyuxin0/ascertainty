/**
 * TheoremSigil — deterministic generative SVG glyph derived from a spec_hash.
 *
 * Aesthetic reference: Sino-Japanese seal/chop (印章 hanko), but using
 * abstract generative strokes rather than borrowed glyph shapes. The mark
 * is square, monochrome with one accent color, with a weathered/hand-stamped
 * feel. Each bounty's sigil is a stable visual identifier — the same
 * spec_hash always produces the same sigil.
 *
 * Used as the bounty's avatar across BountyCard, the bounty detail header,
 * and the Mission Control telemetry view. Persona iNFTs get a sigil too
 * (derived from their on-chain address), giving every entity in the
 * product a bespoke generative mark.
 *
 * Pure SSR-friendly component — no useEffect, no canvas, no client deps.
 */

type Props = {
  hash: string;
  color: string;
  /** outer pixel size; viewBox is 100 x 100 internally */
  size?: number;
  /** optional alt label (e.g. bounty title) for screen readers */
  label?: string;
};

const VIEW = 100;
const FRAME_INSET = 4;
const FRAME_THICKNESS = 3;

export function TheoremSigil({ hash, color, size = 80, label }: Props) {
  const bytes = hashToBytes(hash);
  const rng = mulberry32(bytes[0] + (bytes[1] << 8) + (bytes[2] << 16) + (bytes[3] << 24));

  // Composition decisions, all deterministic from hash bytes.
  const strokeCount = 3 + (bytes[4] % 4); // 3..6 brushstrokes
  const dotCount = 2 + (bytes[5] % 4); // 2..5 weathering specks
  const pipPattern = bytes[6] % 4; // which corner-pip pattern (0..3)
  const innerRotation = (bytes[7] / 255) * 30 - 15; // ±15° asymmetry

  // Generate brushstrokes: curves from a ring point inward, variable weight
  const strokes: Array<{ d: string; w: number }> = [];
  for (let i = 0; i < strokeCount; i++) {
    const angle = (i / strokeCount) * Math.PI * 2 + (bytes[8 + i] / 255) * 0.6;
    const r = 30 + rng() * 12;
    const x1 = 50 + Math.cos(angle) * r;
    const y1 = 50 + Math.sin(angle) * r;
    const x2 = 50 + Math.cos(angle + Math.PI) * (10 + rng() * 8);
    const y2 = 50 + Math.sin(angle + Math.PI) * (10 + rng() * 8);
    // control point off-axis for a calligraphic curve
    const cx = 50 + Math.cos(angle + Math.PI / 2) * (10 + rng() * 14);
    const cy = 50 + Math.sin(angle + Math.PI / 2) * (10 + rng() * 14);
    const w = 2.5 + rng() * 4;
    strokes.push({
      d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      w,
    });
  }

  // Center mark — small generative pictogram (one of three kinds)
  const centerKind = bytes[12] % 3;

  // Weathering dots
  const dots: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < dotCount; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 30 + rng() * 12;
    dots.push({
      x: 50 + Math.cos(angle) * r,
      y: 50 + Math.sin(angle) * r,
      r: 0.5 + rng() * 0.9,
    });
  }

  // Corner pips (small ticks on the frame, signalling rarity / variation)
  const pips: Array<{ x: number; y: number }> = [];
  if (pipPattern & 1) {
    pips.push({ x: FRAME_INSET + 2, y: FRAME_INSET + 2 });
  }
  if (pipPattern & 2) {
    pips.push({ x: VIEW - FRAME_INSET - 2, y: VIEW - FRAME_INSET - 2 });
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={label ?? "theorem sigil"}
      style={{ display: "block" }}
    >
      {/* Subtle paper-texture background — single rect with reduced opacity */}
      <rect
        x={FRAME_INSET}
        y={FRAME_INSET}
        width={VIEW - FRAME_INSET * 2}
        height={VIEW - FRAME_INSET * 2}
        fill="none"
        stroke={color}
        strokeWidth={FRAME_THICKNESS}
        opacity={0.85}
      />
      {/* Inner thin frame (chop double-border feel) */}
      <rect
        x={FRAME_INSET + 5}
        y={FRAME_INSET + 5}
        width={VIEW - (FRAME_INSET + 5) * 2}
        height={VIEW - (FRAME_INSET + 5) * 2}
        fill="none"
        stroke={color}
        strokeWidth={0.6}
        opacity={0.4}
      />

      {/* Inner composition (rotated for asymmetry) */}
      <g transform={`rotate(${innerRotation.toFixed(1)} 50 50)`}>
        {strokes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={color}
            strokeWidth={s.w}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
        {/* Center mark */}
        {centerKind === 0 && (
          <circle cx={50} cy={50} r={3.5} fill={color} opacity={0.9} />
        )}
        {centerKind === 1 && (
          <rect
            x={47}
            y={47}
            width={6}
            height={6}
            fill={color}
            opacity={0.9}
            transform="rotate(45 50 50)"
          />
        )}
        {centerKind === 2 && (
          <>
            <line
              x1={45}
              y1={50}
              x2={55}
              y2={50}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <line
              x1={50}
              y1={45}
              x2={50}
              y2={55}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </>
        )}
      </g>

      {/* Weathering specks */}
      {dots.map((d, i) => (
        <circle
          key={`d${i}`}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={color}
          opacity={0.45}
        />
      ))}

      {/* Corner pips */}
      {pips.map((p, i) => (
        <rect
          key={`p${i}`}
          x={p.x - 1}
          y={p.y - 1}
          width={2}
          height={2}
          fill={color}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

/** Convert a hex string (with or without 0x) into a 16-byte array. */
function hashToBytes(hash: string): number[] {
  const h = (hash || "").replace(/^0x/, "").padEnd(32, "0").slice(0, 32);
  const out: number[] = [];
  for (let i = 0; i < 16; i++) {
    out.push(parseInt(h.slice(i * 2, i * 2 + 2), 16) || 0);
  }
  return out;
}

/** Mulberry32 — deterministic, fast, no deps. */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
