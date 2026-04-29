"use client";

import { recipeForMinion, ROLE_LABELS } from "@/lib/atlas/minionGenerator";

/**
 * Pixel-art-style minion card. Pokemon-shaped frame (rounded rectangle,
 * portrait area, name banner, stat block), with the portrait composed
 * deterministically from the on-chain mint seed.
 *
 * The portrait itself is rendered as inline SVG — geometric primitives
 * with `shape-rendering: crispEdges` to give the pixel-art feel without
 * needing a PNG atlas. (We can swap to Kenney sprite atlas later by
 * replacing <Portrait>; the recipe + frame stay.)
 */

type MinionCardProps = {
  tokenId: number;
  role: number;
  domain: string;
  seed: string;
  mintedAt: number;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { card: "w-44", art: 120, body: 32, frame: "p-2 gap-1.5" },
  md: { card: "w-60", art: 180, body: 48, frame: "p-3 gap-2" },
  lg: { card: "w-72", art: 240, body: 64, frame: "p-4 gap-2.5" },
};

export function MinionCard({
  tokenId,
  role,
  domain,
  seed,
  mintedAt,
  size = "md",
}: MinionCardProps) {
  const recipe = recipeForMinion(seed, role);
  const sz = SIZES[size];
  const roleLabel = ROLE_LABELS[role] ?? "Minion";

  return (
    <div
      className={`${sz.card} border-2 bg-gradient-to-b from-bg/95 to-panel ${sz.frame} flex flex-col font-mono`}
      style={{
        borderColor: recipe.primaryColor,
        boxShadow: `0 0 24px ${recipe.primaryColor}30, inset 0 0 12px ${recipe.primaryColor}10`,
      }}
    >
      {/* Top header strip — token id + role */}
      <div className="flex items-center justify-between text-[9px] uppercase tracking-widest">
        <span className="text-white/40">#{tokenId}</span>
        <span style={{ color: recipe.primaryColor }}>{roleLabel}</span>
      </div>

      {/* Portrait area */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{
          background:
            recipe.backgroundLabel === "void"
              ? "#0a0a14"
              : recipe.backgroundLabel === "stars"
                ? "radial-gradient(circle at 30% 20%, #1a1a2a 0%, #050507 70%)"
                : recipe.backgroundLabel === "dots"
                  ? "radial-gradient(#1a1a22 1px, #050507 1px) 0 0/8px 8px"
                  : "linear-gradient(#0a0a12 1px, transparent 1px) 0 0/12px 12px, linear-gradient(90deg, #0a0a12 1px, transparent 1px) 0 0/12px 12px, #050507",
          imageRendering: "pixelated",
        }}
      >
        <Portrait recipe={recipe} pixelSize={sz.body / 8} />
        {/* Accessory badge top-right */}
        <span
          className="absolute top-1 right-1 text-base"
          aria-hidden
          style={{ filter: "drop-shadow(0 0 4px #000)" }}
        >
          {recipe.accessoryEmoji}
        </span>
      </div>

      {/* Name banner */}
      <div
        className="text-center text-[11px] uppercase tracking-widest font-bold py-1 -mx-1"
        style={{
          background: recipe.primaryColor,
          color: "#030305",
          letterSpacing: "0.15em",
        }}
      >
        {domain.length > 18 ? domain.slice(0, 16) + "…" : domain}
      </div>

      {/* Stat block */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
        <div className="text-white/40 uppercase tracking-widest">body</div>
        <div className="text-white/85 text-right">{recipe.bodyLabel}</div>
        <div className="text-white/40 uppercase tracking-widest">palette</div>
        <div
          className="text-right"
          style={{ color: recipe.primaryColor }}
        >
          {paletteName(recipe.primaryColor)}
        </div>
        <div className="text-white/40 uppercase tracking-widest">field</div>
        <div className="text-white/85 text-right">{recipe.backgroundLabel}</div>
      </div>

      {/* Footer — seed (deterministic from chain) */}
      <div className="text-[8px] font-hash text-white/30 truncate border-t border-line/40 pt-1 mt-0.5">
        seed {seed.slice(0, 14)}…
      </div>
    </div>
  );
}

/** SVG portrait — geometric primitives with crispEdges rendering, sized
 *  by `pixelSize` so it scales 1:1 with the card. The recipe drives the
 *  exact shape, palette, and accessory placement. */
function Portrait({
  recipe,
  pixelSize,
}: {
  recipe: ReturnType<typeof recipeForMinion>;
  pixelSize: number;
}) {
  const p = pixelSize;
  const { primaryColor, secondaryColor, bodyLabel } = recipe;
  // 16x16 pixel art canvas — center the body
  return (
    <svg
      viewBox="0 0 160 160"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", shapeRendering: "crispEdges" }}
    >
      {/* Underglow circle */}
      <ellipse
        cx={80}
        cy={130}
        rx={50}
        ry={8}
        fill={primaryColor}
        opacity={0.2}
      />
      {/* Body — varies by bodyLabel */}
      {bodyLabel === "capsule" && (
        <CapsuleBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "sphere" && (
        <SphereBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "blob" && (
        <BlobBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "cube-bot" && (
        <CubeBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "drop" && (
        <DropBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "ovoid" && (
        <OvoidBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "diamond" && (
        <DiamondBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {bodyLabel === "crystal" && (
        <CrystalBody primary={primaryColor} secondary={secondaryColor} />
      )}
      {/* Eyes — universal across body types */}
      <rect x={68} y={70} width={8} height={8} fill="#030305" />
      <rect x={84} y={70} width={8} height={8} fill="#030305" />
      <rect x={70} y={70} width={3} height={3} fill="#fff" />
      <rect x={86} y={70} width={3} height={3} fill="#fff" />
    </svg>
  );
}

function CapsuleBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <rect x={56} y={50} width={48} height={70} rx={24} fill={primary} />
      <rect x={56} y={50} width={48} height={20} rx={20} fill={secondary} opacity={0.4} />
    </g>
  );
}
function SphereBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <circle cx={80} cy={85} r={36} fill={primary} />
      <circle cx={70} cy={73} r={10} fill={secondary} opacity={0.4} />
    </g>
  );
}
function BlobBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <path
        d="M 50 95 Q 50 50 80 50 Q 110 50 110 95 Q 110 125 80 125 Q 50 125 50 95 Z"
        fill={primary}
      />
      <ellipse cx={70} cy={70} rx={12} ry={6} fill={secondary} opacity={0.4} />
    </g>
  );
}
function CubeBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <rect x={50} y={50} width={60} height={70} fill={primary} />
      <rect x={50} y={50} width={60} height={12} fill={secondary} opacity={0.5} />
      <rect x={50} y={50} width={4} height={70} fill={secondary} opacity={0.7} />
      <rect x={106} y={50} width={4} height={70} fill="#000" opacity={0.3} />
    </g>
  );
}
function DropBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <path
        d="M 80 45 Q 110 80 110 105 Q 110 130 80 130 Q 50 130 50 105 Q 50 80 80 45 Z"
        fill={primary}
      />
      <ellipse cx={70} cy={75} rx={8} ry={5} fill={secondary} opacity={0.5} />
    </g>
  );
}
function OvoidBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <ellipse cx={80} cy={85} rx={28} ry={40} fill={primary} />
      <ellipse cx={70} cy={68} rx={8} ry={12} fill={secondary} opacity={0.4} />
    </g>
  );
}
function DiamondBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <polygon points="80,45 115,85 80,130 45,85" fill={primary} />
      <polygon points="80,45 115,85 80,85" fill={secondary} opacity={0.4} />
    </g>
  );
}
function CrystalBody({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <g>
      <polygon points="80,40 110,75 100,130 60,130 50,75" fill={primary} />
      <polygon points="80,40 110,75 80,80" fill={secondary} opacity={0.5} />
      <polygon points="80,40 50,75 80,80" fill="#000" opacity={0.15} />
    </g>
  );
}

function paletteName(color: string): string {
  const map: Record<string, string> = {
    "#00d4aa": "cyan",
    "#ff6b35": "amber",
    "#a855f7": "violet",
    "#22c55e": "emerald",
    "#ec4899": "rose",
    "#0ea5e9": "sky",
  };
  return map[color] ?? "custom";
}
