import type { DependencyGraph } from "./trackMapping";

/**
 * Hand-crafted dependency graphs, one per example bounty in
 * `specs/examples/`. M5 will derive these automatically from real
 * Lean4 proof structure; M4 ships with these so the demo has variety.
 */

export const MOCK_GRAPHS: Record<string, DependencyGraph> = {
  // sort_correctness — moderate depth, single forward chain with one fork
  sort: {
    nodes: [
      { id: "n0", depth: 0, branchFactor: 1 },
      { id: "n1", depth: 1, branchFactor: 1 },
      { id: "n2", depth: 2, branchFactor: 1, hardness: 0.3 },
      { id: "n3", depth: 3, branchFactor: 2 }, // case split
      { id: "n4", depth: 4, branchFactor: 1 },
      { id: "n5", depth: 5, branchFactor: 1, hardness: 0.5 }, // hard merge
      { id: "n6", depth: 6, branchFactor: 1 },
      { id: "n7", depth: 7, branchFactor: 1 }, // QED
    ],
    edges: [
      { from: "n0", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
    ],
  },

  // erc20_invariant — longer, more branching (inductive cases)
  erc20: {
    nodes: [
      { id: "n0", depth: 0, branchFactor: 1 },
      { id: "n1", depth: 1, branchFactor: 1 },
      { id: "n2", depth: 2, branchFactor: 2 },
      { id: "n3", depth: 3, branchFactor: 1, hardness: 0.4 },
      { id: "n4", depth: 4, branchFactor: 2 },
      { id: "n5", depth: 5, branchFactor: 1 },
      { id: "n6", depth: 6, branchFactor: 1, hardness: 0.7 },
      { id: "n7", depth: 7, branchFactor: 1 },
      { id: "n8", depth: 8, branchFactor: 1 },
      { id: "n9", depth: 9, branchFactor: 1 },
    ],
    edges: [
      { from: "n0", to: "n1" }, { from: "n1", to: "n2" }, { from: "n2", to: "n3" },
      { from: "n3", to: "n4" }, { from: "n4", to: "n5" }, { from: "n5", to: "n6" },
      { from: "n6", to: "n7" }, { from: "n7", to: "n8" }, { from: "n8", to: "n9" },
    ],
  },

  // heat_equation — deep & hard (PDE convergence proof)
  heat: {
    nodes: [
      { id: "n0", depth: 0, branchFactor: 1 },
      { id: "n1", depth: 1, branchFactor: 1 },
      { id: "n2", depth: 2, branchFactor: 1, hardness: 0.5 },
      { id: "n3", depth: 3, branchFactor: 1 },
      { id: "n4", depth: 4, branchFactor: 1, hardness: 0.8 },
      { id: "n5", depth: 5, branchFactor: 1 },
      { id: "n6", depth: 6, branchFactor: 1, hardness: 0.6 },
      { id: "n7", depth: 7, branchFactor: 1 },
      { id: "n8", depth: 8, branchFactor: 1 },
      { id: "n9", depth: 9, branchFactor: 1, hardness: 0.9 },
      { id: "n10", depth: 10, branchFactor: 1 },
      { id: "n11", depth: 11, branchFactor: 1 },
    ],
    edges: Array.from({ length: 11 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
  },

  // mathlib_gap — short, single straight shot
  mathlib: {
    nodes: [
      { id: "n0", depth: 0, branchFactor: 1 },
      { id: "n1", depth: 1, branchFactor: 1 },
      { id: "n2", depth: 2, branchFactor: 1 },
      { id: "n3", depth: 3, branchFactor: 1 },
    ],
    edges: [
      { from: "n0", to: "n1" }, { from: "n1", to: "n2" }, { from: "n2", to: "n3" },
    ],
  },
};

export function pickGraphForBounty(bountyId: string | number): DependencyGraph {
  const id = String(bountyId).toLowerCase();
  if (id.includes("sort")) return MOCK_GRAPHS.sort;
  if (id.includes("erc")) return MOCK_GRAPHS.erc20;
  if (id.includes("heat")) return MOCK_GRAPHS.heat;
  if (id.includes("mathlib") || id.includes("gap")) return MOCK_GRAPHS.mathlib;
  // fall back: deterministic by numeric id
  const keys = Object.keys(MOCK_GRAPHS);
  const n = parseInt(id, 10);
  if (!Number.isNaN(n)) return MOCK_GRAPHS[keys[n % keys.length]];
  return MOCK_GRAPHS.sort;
}

/** Spec features extracted from the bounty YAML; deterministic seed for the
 *  procedural graph. */
export type SpecFeatures = {
  axiomCount: number;
  theoremLength: number;
  mathlibSeed: number;
  bountyIdSlug: string;
};

/** Spec-shaped dependency graph: depth ← theorem complexity, branching ← axiom
 *  whitelist breadth, seed ← mathlib_sha. Stable across re-renders. True Lean4
 *  proof-term DAG extraction is the natural Phase 2; this maps the surface
 *  metadata posters already supply. */
export function graphFromSpec(features: SpecFeatures): DependencyGraph {
  const depth = clamp(Math.round(features.theoremLength / 35), 4, 14);
  const branchFactor = clamp(features.axiomCount, 1, 4);
  let s = features.mathlibSeed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nodes = Array.from({ length: depth + 1 }, (_, i) => {
    const isBranch = i > 0 && i < depth && i % Math.max(2, 6 - branchFactor) === 0;
    const isHard = rand() < 0.18;
    return {
      id: `n${i}`,
      depth: i,
      branchFactor: isBranch ? Math.min(branchFactor, 3) : 1,
      hardness: isHard ? 0.3 + rand() * 0.6 : undefined,
    };
  });
  const edges = Array.from({ length: depth }, (_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
  }));
  return { nodes, edges };
}

/** Lightweight YAML field extraction — avoids pulling a YAML parser
 *  into the client bundle just for these four fields. */
export function specFeaturesFromYaml(yaml: string): SpecFeatures {
  const inAxiomBlock = /axiom_whitelist:\s*\n((?:[ \t]*-[ \t]+.+\n?)+)/m.exec(yaml);
  const axiomCount = inAxiomBlock
    ? (inAxiomBlock[1].match(/^[ \t]*-/gm) ?? []).length
    : 0;
  const thmMatch = /theorem_signature:[ \t]*"?([^"\n]+)"?/.exec(yaml);
  const theoremLength = (thmMatch?.[1] ?? "").length;
  const shaMatch = /mathlib_sha:[ \t]*([0-9a-fA-F]+)/.exec(yaml);
  const mathlibSeed = shaMatch
    ? parseInt((shaMatch[1] + "00000000").slice(0, 8), 16)
    : 0xdeadbeef;
  const idMatch = /bounty_id:[ \t]*([^\s]+)/.exec(yaml);
  return {
    axiomCount,
    theoremLength,
    mathlibSeed,
    bountyIdSlug: idMatch?.[1] ?? "unknown",
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
