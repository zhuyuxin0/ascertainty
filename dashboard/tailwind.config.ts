import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Atmosphere palette (per art-director). Three black-blacks instead
        // of one — a *gradient of ground* gives the cosmos depth even at
        // ambient zoom. `bg` matches Three.js scene clear color exactly so
        // HTML overlays and 3D canvas appear continuous.
        bg: "#04050A", // void
        "bg-deep": "#02030A", // 100% absolute, used in vignette pockets
        panel: "#0A0B12", // chrome, side-panel, breadcrumb
        "panel-raised": "#10121C", // hover'd controls / pinned cards
        line: "#1A1C26", // 1px borders (was 1a1a22)
        divider: "#262838", // subtle separators inside panels

        // Region semantic colors — cohesive with regions.ts so HTML
        // chrome can match the active 3D region tint without copy-pasting
        // RGB triples from regions.ts everywhere.
        cyan: { DEFAULT: "#00d4aa", dim: "#0a8c70" }, // verified, settled
        cold: "#7DD3F7", // math-proofs region
        lavender: "#C7A6FF", // prediction-markets region
        ash: "#3A3F55", // placeholder regions
        amber: { DEFAULT: "#ff6b35" }, // alerts, challenge-window pulse
        warm: "#FF8B5C", // rim-light, secondary warm
        glow: "#67E8F9", // halo highlight
        error: "#F4525E", // destructive states
      },
      fontFamily: {
        // Display: Instrument Serif — used for hero headlines, AS-CERTAIN-TY letters,
        // and any call-out where the type IS the design element.
        display: ["var(--font-instrument-serif)", "ui-serif", "Georgia", "serif"],
        // Data: Space Mono — used for numerals, addresses, code-shaped UI.
        // (Replaces the old JetBrains-Mono-as-default-mono.)
        mono: ["var(--font-space-mono)", "ui-monospace", "monospace"],
        // Hash strings stay on JetBrains Mono so they remain visually distinct.
        hash: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
