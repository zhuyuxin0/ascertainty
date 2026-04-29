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
  /** Z-depth for the 3D cosmos. Live regions sit slightly forward (+),
   *  placeholders slightly back (−), giving parallax when the OrbitControls
   *  camera rotates. Range roughly [-80, 80]. */
  z: number;
  radius: number;
  color: [number, number, number]; // RGB 0-255
  status: RegionStatus;
  comingWhen?: string;
};

export const REGIONS: Region[] = [
  // Top-left: math — cold cyan (atmospheric, structural)
  {
    id: "math-proofs",
    name: "Math Proof Formalization",
    subtitle: "Lean 4 kernel-checked claims",
    position: [-380, 280],
    z: 40,
    radius: 130,
    color: [125, 211, 247], // #7DD3F7 cold cyan
    status: "live",
  },
  // Top-right: AI models — verified-green (the hero region)
  {
    id: "ai-models",
    name: "AI Models",
    subtitle: "Benchmark intelligence map",
    position: [380, 280],
    z: 60,
    radius: 180,
    color: [0, 212, 170], // #00D4AA verified-green
    status: "live",
  },
  // Bottom-left: defi placeholder — ash
  {
    id: "defi-security",
    name: "DeFi Security",
    subtitle: "Formal verification posture",
    position: [-380, -280],
    z: -50,
    radius: 110,
    color: [58, 63, 85], // #3A3F55 ash
    status: "placeholder",
    comingWhen: "Q3 2026",
  },
  // Bottom-right: prediction markets — lavender (consensus, not certainty)
  {
    id: "prediction-markets",
    name: "Prediction Markets",
    subtitle: "Topic-clustered consensus",
    position: [380, -280],
    z: 50,
    radius: 160,
    color: [199, 166, 255], // #C7A6FF lavender
    status: "live",
  },
  // Center-bottom: engineering placeholder — ash
  {
    id: "engineering",
    name: "Engineering Simulations",
    subtitle: "PINN-verified physics",
    position: [0, -440],
    z: -70,
    radius: 100,
    color: [58, 63, 85],
    status: "placeholder",
    comingWhen: "Q3 2026",
  },
  // Center-top: scientific placeholder — ash
  {
    id: "scientific",
    name: "Scientific Claims",
    subtitle: "Preprint → replication → proof",
    position: [0, 460],
    z: -40,
    radius: 100,
    color: [58, 63, 85],
    status: "placeholder",
    comingWhen: "Q4 2026",
  },
];

export function getRegion(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}
