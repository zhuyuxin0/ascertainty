/**
 * Semantic zoom bands. The deck.gl OrthographicView's `zoom` value is the
 * source of truth; each band drives which deck.gl Layers are mounted.
 *
 *   zoom < 0   → COSMOS  (region blobs only, the founding view)
 *   0..3       → DOMAIN  (provider clusters or category clusters within a region)
 *   3..8       → ENTITY  (individual model nodes / market nodes from data)
 *   ≥ 8        → DETAIL  (Layer 4 atomic per-benchmark / per-question drilldown)
 *
 * Layer transitions fade rather than hard-cut to keep the zoom feel smooth.
 */

export type ZoomBand = "cosmos" | "domain" | "entity" | "detail";

export const ZOOM_BANDS: { name: ZoomBand; min: number; max: number }[] = [
  { name: "cosmos", min: -Infinity, max: 0 },
  { name: "domain", min: 0, max: 3 },
  { name: "entity", min: 3, max: 8 },
  { name: "detail", min: 8, max: Infinity },
];

export function bandFromZoom(zoom: number): ZoomBand {
  for (const b of ZOOM_BANDS) {
    if (zoom >= b.min && zoom < b.max) return b.name;
  }
  return "cosmos";
}

/** Smooth fade of layer opacity as zoom crosses a band boundary. */
export function bandOpacity(zoom: number, band: ZoomBand): number {
  const target = ZOOM_BANDS.find((b) => b.name === band);
  if (!target) return 0;
  // Fade in over 0.5 zoom units before the band's min, fade out 0.5 after max
  const FADE = 0.5;
  if (zoom < target.min - FADE) return 0;
  if (zoom > target.max + FADE) return 0;
  if (zoom < target.min) return (zoom - (target.min - FADE)) / FADE;
  if (zoom > target.max) return ((target.max + FADE) - zoom) / FADE;
  return 1;
}
