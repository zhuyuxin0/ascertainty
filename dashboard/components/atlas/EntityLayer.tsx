"use client";

import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";

import {
  type AtlasModel,
  providerColorRGB,
} from "@/lib/atlas/types";

/**
 * Individual AI-model nodes inside the AI Models region. Visible at the
 * "entity" zoom band (3..8). Each node is sized by aggregate score,
 * colored by provider, with a freshness halo (cyan = recent, dim = stale).
 */

const NOW = Math.floor(Date.now() / 1000);
const STALENESS_DAYS = 30; // beyond this, node fully dimmed

function freshnessAlpha(lastUpdatedUnix: number): number {
  const days = Math.max(0, (NOW - lastUpdatedUnix) / 86400);
  if (days >= STALENESS_DAYS) return 0.35;
  return 1 - 0.65 * (days / STALENESS_DAYS);
}

function modelRadius(aggregate: number): number {
  // Map agg [50..95] → radius [4..16] world-units
  const norm = Math.max(0, Math.min(1, (aggregate - 50) / 45));
  return 4 + 12 * norm;
}

export function makeEntityLayers({
  models,
  opacity,
  onClickModel,
  hoveredId,
}: {
  models: AtlasModel[];
  opacity: number;
  onClickModel: (m: AtlasModel) => void;
  hoveredId: string | null;
}) {
  if (opacity <= 0.01) return [];

  const haveLayout = models.filter(
    (m) => m.layout_x !== null && m.layout_y !== null,
  );

  // Halo (freshness glow)
  const halo = new ScatterplotLayer({
    id: "atlas-models-halo",
    data: haveLayout,
    getPosition: (m: AtlasModel) => [m.layout_x as number, m.layout_y as number],
    getRadius: (m: AtlasModel) => modelRadius(m.aggregate) * 1.6,
    getFillColor: (m: AtlasModel) => {
      const [r, g, b] = providerColorRGB(m.provider);
      return [r, g, b, Math.round(opacity * freshnessAlpha(m.last_updated_unix) * 60)];
    },
    radiusUnits: "common",
    pickable: false,
    stroked: false,
  });

  // Body
  const body = new ScatterplotLayer({
    id: "atlas-models-body",
    data: haveLayout,
    getPosition: (m: AtlasModel) => [m.layout_x as number, m.layout_y as number],
    getRadius: (m: AtlasModel) => modelRadius(m.aggregate),
    getFillColor: (m: AtlasModel) => {
      const [r, g, b] = providerColorRGB(m.provider);
      const a = Math.round(opacity * freshnessAlpha(m.last_updated_unix) * 220);
      return [r, g, b, a];
    },
    radiusUnits: "common",
    pickable: true,
    onClick: (info) => {
      if (info.object) onClickModel(info.object as AtlasModel);
    },
    autoHighlight: true,
    highlightColor: [255, 255, 255, 120],
    stroked: true,
    getLineColor: (m: AtlasModel) => [255, 255, 255, m.model_id === hoveredId ? 220 : 0],
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
    updateTriggers: {
      getLineColor: [hoveredId],
    },
  });

  // Labels — visible only when reasonably zoomed in
  const labels = new TextLayer({
    id: "atlas-models-labels",
    data: haveLayout,
    getPosition: (m: AtlasModel) => [
      m.layout_x as number,
      (m.layout_y as number) + modelRadius(m.aggregate) + 8,
    ],
    getText: (m: AtlasModel) => m.name,
    getColor: () => [255, 255, 255, Math.round(opacity * 200)],
    getSize: 10,
    fontFamily: "ui-sans-serif, system-ui",
    characterSet: "auto",
    getTextAnchor: "middle",
    getAlignmentBaseline: "bottom",
    pickable: false,
  });

  return [halo, body, labels];
}
