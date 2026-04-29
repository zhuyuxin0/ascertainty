"use client";

import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";

import { type Region } from "@/lib/atlas/regions";

/**
 * The cosmos-zoom layer: 6 region blobs as soft-edged circles + labels.
 * Live regions glow cyan; placeholders sit in muted grey with "coming"
 * subtitle. Click handler bubbles up so the page can fly the camera into
 * the clicked region.
 *
 * Returns a list of deck.gl layers — the page composes them into the
 * DeckGL `layers` array.
 */
export function makeCosmosLayers({
  regions,
  onClickRegion,
  zoom,
}: {
  regions: Region[];
  onClickRegion: (r: Region) => void;
  zoom: number;
}) {
  // Outer glow — large, soft, low-alpha
  const glow = new ScatterplotLayer({
    id: "cosmos-glow",
    data: regions,
    getPosition: (r: Region) => r.position,
    getRadius: (r: Region) => r.radius * 1.4,
    getFillColor: (r: Region) => [
      r.color[0],
      r.color[1],
      r.color[2],
      r.status === "live" ? 22 : 14,
    ],
    radiusUnits: "common",
    pickable: false,
    stroked: false,
  });

  // Mid blob — main body
  const body = new ScatterplotLayer({
    id: "cosmos-body",
    data: regions,
    getPosition: (r: Region) => r.position,
    getRadius: (r: Region) => r.radius,
    getFillColor: (r: Region) => [
      r.color[0],
      r.color[1],
      r.color[2],
      r.status === "live" ? 50 : 26,
    ],
    radiusUnits: "common",
    pickable: true,
    onClick: (info) => {
      if (info.object) onClickRegion(info.object as Region);
    },
    autoHighlight: true,
    highlightColor: [255, 255, 255, 50],
    stroked: true,
    getLineColor: (r: Region) => [r.color[0], r.color[1], r.color[2], 180],
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
  });

  // Core dot
  const core = new ScatterplotLayer({
    id: "cosmos-core",
    data: regions,
    getPosition: (r: Region) => r.position,
    getRadius: (r: Region) => Math.max(4, r.radius * 0.04),
    getFillColor: (r: Region) => [
      r.color[0],
      r.color[1],
      r.color[2],
      r.status === "live" ? 220 : 120,
    ],
    radiusUnits: "common",
    pickable: false,
  });

  // Region name (large)
  const nameLayer = new TextLayer({
    id: "cosmos-names",
    data: regions,
    getPosition: (r: Region) => [r.position[0], r.position[1] + r.radius + 28],
    getText: (r: Region) => r.name.toUpperCase(),
    getColor: (r: Region) =>
      r.status === "live" ? [0, 212, 170, 230] : [200, 200, 210, 130],
    getSize: 14,
    fontFamily: "ui-monospace, monospace",
    characterSet: "auto",
    fontWeight: "bold",
    getTextAnchor: "middle",
    getAlignmentBaseline: "bottom",
    pickable: false,
  });

  // Region subtitle
  const subtitleLayer = new TextLayer({
    id: "cosmos-subtitles",
    data: regions,
    getPosition: (r: Region) => [r.position[0], r.position[1] + r.radius + 12],
    getText: (r: Region) =>
      r.status === "live"
        ? r.subtitle
        : `${r.subtitle} · ${r.comingWhen ?? "coming"}`,
    getColor: (r: Region) =>
      r.status === "live" ? [255, 255, 255, 130] : [200, 200, 210, 90],
    getSize: 11,
    fontFamily: "ui-sans-serif, system-ui",
    characterSet: "auto",
    getTextAnchor: "middle",
    getAlignmentBaseline: "bottom",
    pickable: false,
  });

  // Status pip (bottom of blob) — only on placeholders
  const placeholders = regions.filter((r) => r.status === "placeholder");
  const placeholderPip = new TextLayer({
    id: "cosmos-placeholder-pip",
    data: placeholders,
    getPosition: (r: Region) => [r.position[0], r.position[1] - r.radius - 16],
    getText: () => "○ placeholder",
    getColor: () => [200, 200, 210, 110],
    getSize: 9,
    fontFamily: "ui-monospace, monospace",
    characterSet: "auto",
    getTextAnchor: "middle",
    getAlignmentBaseline: "top",
    pickable: false,
  });

  return [glow, body, core, nameLayer, subtitleLayer, placeholderPip];
}
