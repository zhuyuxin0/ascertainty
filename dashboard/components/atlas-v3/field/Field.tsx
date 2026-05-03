/* Field — the cream paper canvas of the v3 atlas.
 *
 * Layers, bottom to top:
 *   1. Cream paper bg (#FAF6E8) with multiplied paper grain
 *   2. Cartographic grid: 64px × 64px ruled hairlines at 12% ink
 *   3. Center crosshairs (40% line at 50/50)
 *   4. Editorial watermark — giant Instrument Serif italic "atlas" at
 *      ~28vw, low-opacity ink, sitting behind everything
 *   5. {children} — the cosmos SVG canvas + everything HUD-side
 *
 * Acts purely as a backdrop. Doesn't manage state. */
import type { ReactNode } from "react";

export function Field({ children }: { children: ReactNode }) {
  return (
    <main
      className="fixed inset-0 overflow-hidden"
      style={{
        backgroundColor: "#FAF6E8",
        // Paper grain — multiplied for a printed-stock feel
        backgroundImage: `
          radial-gradient(circle at 18% 22%, rgba(10,21,37,0.045) 0.6px, transparent 1.1px),
          radial-gradient(circle at 72% 64%, rgba(10,21,37,0.035) 0.5px, transparent 1px),
          radial-gradient(circle at 38% 86%, rgba(10,21,37,0.04) 0.6px, transparent 1.1px),
          radial-gradient(circle at 60% 12%, rgba(184, 118, 20, 0.025) 1.2px, transparent 2.2px)
        `,
        backgroundSize: "14px 14px, 11px 11px, 19px 19px, 27px 27px",
        backgroundBlendMode: "multiply",
      }}
    >
      {/* Cartographic grid — printed-map ruling, every line at 12% ink */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(10,21,37,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10,21,37,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          opacity: 0.7,
        }}
      />

      {/* Center crosshairs — frame the cartographic field */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-1/2 h-px pointer-events-none"
        style={{ background: "rgba(10,21,37,0.12)", opacity: 0.4 }}
      />
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 w-px pointer-events-none"
        style={{ background: "rgba(10,21,37,0.12)", opacity: 0.4 }}
      />

      {/* Editorial watermark — "atlas" set as a deboss in the paper */}
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center pointer-events-none z-[1] select-none"
      >
        <span
          className="font-display italic"
          style={{
            fontSize: "clamp(240px, 28vw, 480px)",
            fontWeight: 400,
            lineHeight: 0.85,
            letterSpacing: "-0.04em",
            color: "rgba(10, 21, 37, 0.025)",
            whiteSpace: "nowrap",
          }}
        >
          atlas
        </span>
        <span
          className="absolute font-mono uppercase"
          style={{
            bottom: "12%",
            fontSize: 9,
            letterSpacing: "0.32em",
            color: "rgba(10, 21, 37, 0.08)",
          }}
        >
          vol. iv · the verification quarterly · 2026
        </span>
      </div>

      {children}
    </main>
  );
}
