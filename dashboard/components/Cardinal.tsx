/* Cardinal — the brand mark.
 *
 * Persimmon square, bone crosshair, jade center dot. Six variants ship in
 * /public/logo:
 *   daylight        cream field (landing + claim)
 *   evening         dusk field  (atlas)
 *   mono-dark       single-colour on light
 *   mono-light      single-colour on dark
 *   outline         stroke only
 *   lockup-evening  mark + wordmark, dusk
 *
 * The component renders an <img> rather than inlining the SVG so the
 * shared `view-transition-name: brand` cross-page handoff has a stable
 * DOM node to morph between landing → atlas → claim.
 */
import Image from "next/image";

type Variant = "daylight" | "evening" | "mono-dark" | "mono-light" | "outline" | "lockup-evening";

export function Cardinal({
  variant = "daylight",
  size = 28,
  className = "",
  withTransition = false,
}: {
  variant?: Variant;
  size?: number;
  className?: string;
  /** Apply view-transition-name="brand" so cross-page navigation between
   *  landing/atlas/claim morphs the mark in place. */
  withTransition?: boolean;
}) {
  return (
    <Image
      src={`/logo/cardinal-${variant}.svg`}
      width={size}
      height={size}
      alt="Ascertainty"
      className={className}
      style={withTransition ? { viewTransitionName: "brand" } : undefined}
      priority={withTransition}
    />
  );
}
