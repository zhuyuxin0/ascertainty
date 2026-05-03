/* DomainView — band 2. Renders the focused region's interior:
 * a large hexagon (the region body) with sub-domain circles dropped
 * inside on a 2×2 grid. Click a sub-domain → band → entity.
 *
 * For Phase 2-5 the focus is hardcoded to AI Models per the canonical
 * design reference. Phase 6 wires this to `state.region` so each region
 * can render its own hexagon + subs from lib/atlas-v3/regions.ts. */

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { REGIONS, SUB_DOMAINS } from "@/lib/atlas-v3/regions";

export function DomainView() {
  const region = useAtlasV3((s) => s.region) ?? "ai-models";
  const setBand = useAtlasV3((s) => s.setBand);
  const setEntity = useAtlasV3((s) => s.setEntity);
  const pushToast = useAtlasV3((s) => s.pushToast);
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);

  const r = REGIONS.find((x) => x.id === region)!;
  const subs = SUB_DOMAINS[r.id];
  const wash = `${r.color}0D`;
  const hex = `${r.color}14`;

  const onSubClick = (label: string) => {
    setEntity(label.toLowerCase());
    setBand("entity");
    pushToast({ glyph: "→", label: "entered entity", em: ` ${label.toLowerCase()}` });
  };

  const tipFor = (label: string, sub: string) => ({
    onMouseEnter: (e: React.MouseEvent) =>
      showTooltip(
        {
          label: `sub-domain · ${label.toLowerCase()}`,
          body: `${sub} cluster. Click to drill into the entity ring.`,
          keys: [["click", "band → entity"]],
        },
        e,
      ),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  });

  return (
    <g style={{ transformOrigin: "800px 450px" }}>
      <rect x={0} y={0} width={1600} height={900} fill={wash} />
      <g transform="translate(800, 450)">
        <polygon
          points="0,-180 156,-90 156,90 0,180 -156,90 -156,-90"
          fill={hex}
          stroke={r.color}
          strokeWidth={1.4}
        />
        <text
          x={0}
          y={-220}
          textAnchor="middle"
          fontFamily="var(--font-instrument-serif), serif"
          fontSize={40}
          fontStyle="italic"
          fill="rgba(10,21,37,0.94)"
        >
          {r.name}
        </text>
        <text
          x={0}
          y={-194}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={11}
          fill={r.color}
          letterSpacing={3}
        >
          DOMAIN · {subs.length * 12} ENTITIES
        </text>
        {subs.map((s, i) => (
          <g
            key={s.label}
            transform={`translate(${s.dx}, ${s.dy})`}
            style={{ cursor: "pointer" }}
            onClick={() => onSubClick(s.label)}
            {...tipFor(s.label, s.sub)}
          >
            <circle r={56} fill="rgba(255,255,255,0.6)" stroke={s.color} strokeWidth={1} strokeDasharray="2 4" />
            <circle r={7} fill={s.color} />
            <text
              y={-12}
              textAnchor="middle"
              fontFamily="var(--font-instrument-serif), serif"
              fontSize={18}
              fontStyle="italic"
              fill="rgba(10,21,37,0.94)"
            >
              {s.label}
            </text>
            <text
              y={4}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={8}
              fill="rgba(10,21,37,0.5)"
              letterSpacing={2}
            >
              {s.sub.toUpperCase()}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
}
