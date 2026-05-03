/* raceTrack2d — proof-spec complexity → 2D ink-line course (cream paper).
 *
 * The 3D Bruno-Simon-style race scene at components/Race.tsx is preserved
 * in the repo, but it doesn't fit the cream-paper visual identity. This
 * module re-implements the *complexity → track* mapping (CLAUDE.md M4) as
 * a pure 2D SVG path so the live race can be rendered inline inside the
 * cream claim proceedings without any glow / fog / dark asphalt.
 *
 * Same conceptual mapping as the 3D version:
 *   depth      → segment count                  (longer course)
 *   breadth    → primary band amplitude         (wider sweeps)
 *   branching  → number of fork glyphs          (decisions visible on path)
 *   hardness   → curvature multiplier           (tighter switchbacks)
 *
 * Output is geometry only. Rendering, animation, and HUD live in
 * components/claim/CourseLive.tsx. The path is sampled at fixed density
 * so we can `lerp` along it cheaply on every frame without touching the
 * DOM (avoids SVGPathElement.getPointAtLength and lets us SSR).
 */

export type TrackSpec = {
  /** 1..10 — how long the chain of sub-goals is */
  depth: number;
  /** 1..10 — parallel sub-goals, drives amplitude of the primary sweep */
  breadth: number;
  /** number of visible decision points (case splits) */
  branching: number;
  /** 0..1 — proxies for "known-hard lemmas"; tightens curves */
  hardness: number;
};

export type Pt = { x: number; y: number };

export type Track2D = {
  /** flattened sample of the centerline, evenly spaced; length ≈ samples */
  samples: Pt[];
  /** SVG path "d" attribute — smooth Catmull-ish bezier through samples */
  d: string;
  /** total polyline length in viewBox units (for HUD) */
  length: number;
  /** spawn / finish endpoints */
  spawn: Pt;
  finish: Pt;
  /** small markers along the path where the proof "branches" */
  forks: Pt[];
  /** the viewBox the path was authored in */
  viewBox: { w: number; h: number };
};

/**
 * Derive a TrackSpec from the scalar complexity rubric we already store
 * on every bounty. If difficulty / breadth aren't present yet (older
 * bounties) we fall back to mid-range so the track still renders.
 */
export function specFromBounty(b: {
  difficulty?: number | null;
  novelty?: number | null;
  erdos_class?: number | null;
}): TrackSpec {
  const difficulty = clamp(b.difficulty ?? 5, 1, 10);
  const novelty = clamp(b.novelty ?? 5, 1, 10);
  // erdos_class is 0..10 in practice (0 = unrated, 1 = close to known
  // math, 10 = frontier). Treat 0 as "unknown → mid-range" so the
  // track still renders with interesting curvature.
  const erdosRaw = b.erdos_class ?? 0;
  const erdos = erdosRaw === 0 ? 5 : clamp(erdosRaw, 1, 10);
  return {
    depth: difficulty,
    breadth: Math.max(2, Math.round((novelty + difficulty) / 3)),
    branching: Math.max(1, Math.floor(difficulty / 3)),
    hardness: (erdos - 1) / 9,
  };
}

const VIEW_W = 1200;
const VIEW_H = 320;
const MARGIN_X = 64;
const MARGIN_Y = 60;

/**
 * Build the full 2D course geometry. The centerline is a sum of two
 * sinusoids: a long primary sweep set by `breadth`, plus a short
 * harmonic whose amplitude grows with `hardness` (creates switchbacks).
 * Sampling is uniform in t over [0,1].
 */
export function buildTrack2D(spec: TrackSpec): Track2D {
  const samples = 240;
  const usableW = VIEW_W - MARGIN_X * 2;
  const midY = VIEW_H / 2;
  const primaryAmp = lerp(28, 80, clamp(spec.breadth / 10, 0, 1));
  const primaryFreq = 0.9 + spec.depth * 0.18;
  const harmonicAmp = primaryAmp * 0.45 * spec.hardness;
  const harmonicFreq = primaryFreq * 3.2;

  const pts: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const x = MARGIN_X + t * usableW;
    const y =
      midY +
      Math.sin(t * Math.PI * primaryFreq * 2) * primaryAmp +
      Math.sin(t * Math.PI * harmonicFreq * 2 + 1.7) * harmonicAmp;
    pts.push({ x, y: clamp(y, MARGIN_Y, VIEW_H - MARGIN_Y) });
  }

  // Length = sum of segment distances, used for HUD ("course · 1.4k units")
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += dist(pts[i - 1], pts[i]);

  // Forks: pick N evenly-spaced indices skipping the first/last 8% so the
  // glyphs don't crowd spawn/finish.
  const forks: Pt[] = [];
  const n = Math.min(spec.branching, 5);
  for (let k = 0; k < n; k++) {
    const t = 0.18 + (0.64 * (k + 0.5)) / Math.max(1, n);
    const idx = Math.round(t * (samples - 1));
    forks.push(pts[idx]);
  }

  return {
    samples: pts,
    d: smoothPath(pts),
    length,
    spawn: pts[0],
    finish: pts[pts.length - 1],
    forks,
    viewBox: { w: VIEW_W, h: VIEW_H },
  };
}

/** Position along the path at fraction `p` (0 = spawn, 1 = finish). */
export function positionAt(track: Track2D, p: number): Pt {
  const samples = track.samples;
  const clamped = clamp(p, 0, 1);
  const idx = clamped * (samples.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, samples.length - 1);
  const f = idx - lo;
  return {
    x: samples[lo].x + (samples[hi].x - samples[lo].x) * f,
    y: samples[lo].y + (samples[hi].y - samples[lo].y) * f,
  };
}

/** Tangent angle (radians) at fraction p — used to rotate car glyphs. */
export function tangentAt(track: Track2D, p: number): number {
  const samples = track.samples;
  const idx = clamp(p, 0, 1) * (samples.length - 1);
  const lo = Math.max(0, Math.floor(idx) - 1);
  const hi = Math.min(samples.length - 1, lo + 2);
  const dx = samples[hi].x - samples[lo].x;
  const dy = samples[hi].y - samples[lo].y;
  return Math.atan2(dy, dx);
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  // Quadratic Bézier through midpoints — visually identical to a
  // Catmull-Rom and trivial to express as SVG without a curve library.
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
