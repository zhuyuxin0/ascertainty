/* Atlas v3 — region + sub-domain + persona definitions.
 *
 * The cartographic layout is fixed (matches design_handoff_atlas_v3's
 * canonical SVG coordinates 0–1600 × 0–900). Sub-domain + entity
 * positions follow per-region ring formulas; persona drift positions
 * are seeded from their slug for stability across sessions.
 *
 * Counts/labels are wire-able from the backend at render time (see
 * components/atlas-v3/Cosmos.tsx). The pigment hexes here are the
 * canonical region tints on cream paper. */

export type RegionDef = {
  id: "math-proofs" | "ai-models" | "prediction-markets";
  name: string;
  subtitle: string;
  /** Stage-space center in the 1600×900 SVG viewBox. */
  cx: number;
  cy: number;
  /** Halo + cluster radii. */
  haloR: number;
  innerR: number;
  /** Region pigment (paper-tuned ink, not glowing). */
  color: string;
  /** Wash background tint. */
  wash: string;
  /** Glyph shape used for the cluster center + entity tokens. */
  shape: "diamond" | "hexagon" | "octagon";
  /** Live label fragment ("MODELS", "BOUNTIES", "MARKETS"). */
  unit: string;
};

export const REGIONS: RegionDef[] = [
  {
    id: "ai-models",
    name: "AI Models",
    subtitle: "Provider-clustered benchmarks",
    cx: 1100, cy: 280,
    haloR: 180, innerR: 140,
    color: "#7B5BA8", wash: "rgba(123,91,168,0.06)",
    shape: "hexagon",
    unit: "MODELS",
  },
  {
    id: "math-proofs",
    name: "Math Proofs",
    subtitle: "Lean 4 kernel-checked claims",
    cx: 540, cy: 600,
    haloR: 140, innerR: 100,
    color: "#2A7A8F", wash: "rgba(42,122,143,0.06)",
    shape: "diamond",
    unit: "BOUNTIES",
  },
  {
    id: "prediction-markets",
    name: "Prediction Markets",
    subtitle: "Topic-clustered consensus",
    cx: 1280, cy: 720,
    haloR: 160, innerR: 120,
    color: "#B85A42", wash: "rgba(184,90,66,0.06)",
    shape: "octagon",
    unit: "MARKETS",
  },
];

/** Ash placeholders — Q3/Q4 2026 frontier regions. Not clickable. */
export const PLACEHOLDERS = [
  { id: "defi-security",     name: "DeFi Security",     cx: 220, cy: 230, r: 70, when: "Q3 2026" },
  { id: "scientific-claims", name: "Scientific Claims", cx: 820, cy: 90,  r: 60, when: "Q4 2026" },
  { id: "engineering",       name: "Engineering",       cx: 180, cy: 730, r: 55, when: "Q3 2026" },
];

/** Persona drift positions (cosmos band). Seeded from slug so the
 *  dots land in the same spot every render. */
export const PERSONAS = [
  { slug: "aggressive-andy", short: "ANDY", emoji: "🔥", color: "#C76A2B", x: 780, y: 420 },
  { slug: "careful-carl",    short: "CARL", emoji: "🧊", color: "#2A7A8F", x: 900, y: 550 },
  { slug: "balanced-bea",    short: "BEA",  emoji: "⚖️", color: "#7B5BA8", x: 1050, y: 480 },
];

/** Sub-domain children that explode out of a region at the domain
 *  band. Hand-curated for the AI Models region; other regions extend
 *  this map as they get sub-domain authoring. */
export type SubDomain = {
  label: string;
  sub: string;
  /** Local offset from domain-view center (800, 450). */
  dx: number;
  dy: number;
  color: string;
};

export const SUB_DOMAINS: Record<RegionDef["id"], SubDomain[]> = {
  "ai-models": [
    { label: "LLM",    sub: "Frontier",     dx: -95, dy: -50, color: "#7B5BA8" },
    { label: "Reason", sub: "Multi-step",   dx:  95, dy: -50, color: "#5B7BA8" },
    { label: "Vision", sub: "Multimodal",   dx: -95, dy:  60, color: "#A86B7B" },
    { label: "Code",   sub: "Programming",  dx:  95, dy:  60, color: "#7BA85B" },
  ],
  "math-proofs": [
    { label: "Algebra", sub: "Number theory", dx: -95, dy: -50, color: "#2A7A8F" },
    { label: "Topology", sub: "Geometric",    dx:  95, dy: -50, color: "#3F8FA8" },
    { label: "Analysis", sub: "Real + complex", dx: -95, dy:  60, color: "#558FA8" },
    { label: "Logic",    sub: "Foundations",  dx:  95, dy:  60, color: "#1F6F8E" },
  ],
  "prediction-markets": [
    { label: "Macro", sub: "Economy + rates", dx: -95, dy: -50, color: "#B85A42" },
    { label: "Tech",  sub: "Ship dates + benchmarks", dx: 95, dy: -50, color: "#A86B5A" },
    { label: "Geo",   sub: "Politics + conflict", dx: -95, dy: 60, color: "#9C4A3C" },
    { label: "Sci",   sub: "Replications",     dx:  95, dy:  60, color: "#C76A4B" },
  ],
};
