/**
 * Hardcoded region positions for the cosmos view. The 6 regions live at
 * deliberate x-y locations so the layout reads as a deliberate map, not
 * a UMAP-randomized blob field. UMAP is used INSIDE each live region for
 * the individual nodes, but the region centers themselves are fixed.
 */

export type RegionStatus = "live" | "placeholder";

export type Region = {
  id: string;
  name: string;
  subtitle: string;
  position: [number, number];
  radius: number;
  color: [number, number, number]; // RGB 0-255
  status: RegionStatus;
  comingWhen?: string;
};

export const REGIONS: Region[] = [
  // Top-left: math
  {
    id: "math-proofs",
    name: "Math Proof Formalization",
    subtitle: "Lean 4 kernel-checked claims",
    position: [-380, 280],
    radius: 130,
    color: [0, 212, 170],
    status: "live",
  },
  // Top-right: AI models — main hero region
  {
    id: "ai-models",
    name: "AI Models",
    subtitle: "Benchmark intelligence map",
    position: [380, 280],
    radius: 180,
    color: [0, 212, 170],
    status: "live",
  },
  // Bottom-left: defi placeholder
  {
    id: "defi-security",
    name: "DeFi Security",
    subtitle: "Formal verification posture",
    position: [-380, -280],
    radius: 110,
    color: [110, 110, 130],
    status: "placeholder",
    comingWhen: "Q3 2026",
  },
  // Bottom-right: prediction markets
  {
    id: "prediction-markets",
    name: "Prediction Markets",
    subtitle: "Topic-clustered consensus",
    position: [380, -280],
    radius: 160,
    color: [0, 212, 170],
    status: "live",
  },
  // Center-bottom: engineering placeholder
  {
    id: "engineering",
    name: "Engineering Simulations",
    subtitle: "PINN-verified physics",
    position: [0, -440],
    radius: 100,
    color: [110, 110, 130],
    status: "placeholder",
    comingWhen: "Q3 2026",
  },
  // Center-top: scientific claims placeholder
  {
    id: "scientific",
    name: "Scientific Claims",
    subtitle: "Preprint → replication → proof",
    position: [0, 460],
    radius: 100,
    color: [110, 110, 130],
    status: "placeholder",
    comingWhen: "Q4 2026",
  },
];

export function getRegion(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}
