/* EntityView — band 3. A single entity sits at the center as a small
 * region-shaped glyph; 12 satellite circles ring it on a phyllotaxis
 * arc, each annotated with a confidence score (0-99). Click a satellite
 * → band → detail.
 *
 * Confidence colors: > 80 jade · > 50 lavender · ≤ 50 persimmon. */

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { REGIONS } from "@/lib/atlas-v3/regions";

const CONFIDENCES = [94, 71, 52, 88, 21, 67, 82, 45, 91, 38, 76, 59];

const tone = (c: number) => (c > 80 ? "#1F8FA8" : c > 50 ? "#7B5BA8" : "#C76A2B");

export function EntityView() {
  const region = useAtlasV3((s) => s.region) ?? "ai-models";
  const entity = useAtlasV3((s) => s.entity) ?? "claude-sonnet-4.5";
  const setBand = useAtlasV3((s) => s.setBand);
  const togglePanel = useAtlasV3((s) => s.togglePanel);
  const pushToast = useAtlasV3((s) => s.pushToast);
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);

  const r = REGIONS.find((x) => x.id === region)!;

  const onSatellite = (i: number, conf: number) => {
    setBand("detail");
    togglePanel("bounties");
    pushToast({ glyph: "↗", label: "bounty opened", em: ` ${conf}% conf` });
  };

  const tipFor = (conf: number) => ({
    onMouseEnter: (e: React.MouseEvent) =>
      showTooltip(
        {
          label: `bounty node · ${conf}% conf`,
          body: "A live bounty on this entity. Click to open the bounty detail.",
          keys: [["click", "band → detail · bounty card"]],
        },
        e,
      ),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  });

  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={`${r.color}0D`} />
      <g transform="translate(800, 450)">
        <text
          y={-280}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill="rgba(10,21,37,0.46)"
          letterSpacing={3}
        >
          {r.name.toUpperCase()} · LLM · FRONTIER
        </text>
        <text
          y={-238}
          textAnchor="middle"
          fontFamily="var(--font-instrument-serif), serif"
          fontSize={42}
          fontStyle="italic"
          fill="rgba(10,21,37,0.94)"
        >
          {entity}
        </text>
        <text
          y={-210}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={r.color}
          letterSpacing={3}
        >
          ENTITY · 12 LIVE BOUNTIES
        </text>

        <circle r={170} fill="none" stroke={`${r.color}4D`} strokeWidth={1} strokeDasharray="3 6" />
        {CONFIDENCES.map((conf, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * 170;
          const y = Math.sin(a) * 170;
          const col = tone(conf);
          return (
            <g
              key={i}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSatellite(i, conf)}
              {...tipFor(conf)}
            >
              <circle r={18} fill="#FAF6E8" stroke={col} strokeWidth={1.2} />
              <text
                y={4}
                textAnchor="middle"
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={10}
                fontWeight={600}
                fill={col}
              >
                {conf}
              </text>
            </g>
          );
        })}
        {/* Center entity glyph — small region-shape */}
        <g>
          <polygon points="0,-44 38,-22 38,22 0,44 -38,22 -38,-22" fill={`${r.color}1A`} stroke={r.color} strokeWidth={1.6} />
          <circle r={5} fill={r.color} />
        </g>
      </g>
    </g>
  );
}
