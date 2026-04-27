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
