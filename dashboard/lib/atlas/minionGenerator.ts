/**
 * Deterministic minion-card art recipe.
 *
 * Given a mint seed (uint64 from the contract's MinionMinted event), pick:
 *   - body shape index (0..7)
 *   - color palette index (0..5)
 *   - accessory index (0..5)
 *   - background pattern index (0..3)
 *
 * The picks are deterministic: same seed → same card. ~128 × 6 × 6 × 4 ≈
 * 18k visually distinct combinations from a small asset library.
 *
 * Card visuals are drawn at composeMinionCard() time using HTML <Canvas>
 * sprite compositing — no external fetch, no async, no shader code. The
 * sprites themselves are CSS background-position rectangles into a
 * single PNG atlas we ship at /sprites/minions/atlas.png.
 *
 * Until that atlas exists, the composer falls back to a procedural SVG
 * render that uses the same recipe — so the wiring works end-to-end and
 * we can swap the atlas in later without changing call sites.
 */

import { providerColorRGB } from "@/lib/atlas/types";

export type MinionRecipe = {
  bodyIdx: number;
  paletteIdx: number;
  accessoryIdx: number;
  backgroundIdx: number;
  primaryColor: string;
  secondaryColor: string;
  accessoryEmoji: string;
  backgroundLabel: string;
  bodyLabel: string;
};

/* Aurora-tuned palette. Order preserved so existing minted minions
 * keep their paletteIdx → palette mapping (the on-chain seed drives
 * the index; only the hex values changed from the legacy primaries
 * to the aurora aliases that match the landing/claim system). */
const PALETTES: Array<{ name: string; primary: string; secondary: string }> = [
  { name: "peacock",   primary: "#7DD3F7", secondary: "#2A6F8E" },
  { name: "persimmon", primary: "#FFB849", secondary: "#B97614" },
  { name: "lavender",  primary: "#B59AE5", secondary: "#5E468F" },
  { name: "math",      primary: "#6FBFD9", secondary: "#3F7B8E" },
  { name: "rose",      primary: "#F0617D", secondary: "#9C2D44" },
  { name: "mkt",       primary: "#D9847E", secondary: "#8E4A45" },
];

const BODIES = [
  "capsule",
  "sphere",
  "blob",
  "cube-bot",
  "drop",
  "ovoid",
  "diamond",
  "crystal",
];

const ACCESSORIES = [
  { emoji: "📡", name: "antenna" },
  { emoji: "🎩", name: "hat" },
  { emoji: "🔭", name: "scope" },
  { emoji: "📜", name: "scroll" },
  { emoji: "🔮", name: "orb" },
  { emoji: "🪶", name: "wing" },
];

const BACKGROUNDS = ["stars", "dots", "grid", "void"];

/** Mulberry32 PRNG — deterministic, fast, no deps. */
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

/** Compose a recipe from a uint64 seed (as a string from chain). */
export function recipeFromSeed(seedStr: string): MinionRecipe {
  // Reduce uint64 to a 32-bit number for mulberry32 — XOR upper and lower halves
  let n: number;
  try {
    const big = BigInt(seedStr);
    const lower = Number(big & 0xffffffffn);
    const upper = Number((big >> 32n) & 0xffffffffn);
    n = (lower ^ upper) >>> 0;
  } catch {
    n = 0xdeadbeef;
  }
  const rand = mulberry32(n);
  const bodyIdx = Math.floor(rand() * BODIES.length);
  const paletteIdx = Math.floor(rand() * PALETTES.length);
  const accessoryIdx = Math.floor(rand() * ACCESSORIES.length);
  const backgroundIdx = Math.floor(rand() * BACKGROUNDS.length);
  const palette = PALETTES[paletteIdx];
  return {
    bodyIdx,
    paletteIdx,
    accessoryIdx,
    backgroundIdx,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    accessoryEmoji: ACCESSORIES[accessoryIdx].emoji,
    backgroundLabel: BACKGROUNDS[backgroundIdx],
    bodyLabel: BODIES[bodyIdx],
  };
}

/** Helper: role 0/1/2 → label. */
export const ROLE_LABELS = ["Spotter", "Solver", "Spectator"] as const;
/* Aurora-tuned role colors:
 *   Spotter    → peacock-bright (verified · settled semantics)
 *   Solver     → persimmon-bright (active · contesting · pending)
 *   Spectator  → r-ai lavender (markets · prediction)
 * Index order preserved so on-chain role bytes still resolve to the
 * intended semantic colour. */
export const ROLE_COLORS = ["#7DD3F7", "#FFB849", "#B59AE5"] as const;

/** Override the recipe primary color to match the role color. The seed
 *  still drives all other details — accessory, body, background — so two
 *  same-role minions still look visibly different. */
export function recipeForMinion(seed: string, role: number): MinionRecipe {
  const r = recipeFromSeed(seed);
  if (role >= 0 && role < ROLE_COLORS.length) {
    r.primaryColor = ROLE_COLORS[role];
  }
  return r;
}

// Re-export for convenience in card components
export { providerColorRGB };
