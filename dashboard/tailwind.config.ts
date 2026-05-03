import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tailwind's default opacity scale tops out with steps of 5/10. The
      // aurora design system's foreground rungs land at non-standard
      // values: 0.94 / 0.66 / 0.46 / 0.26 (ink, on cream) and 0.96 /
      // 0.66 / 0.42 / 0.22 (bone, on dusk inserts). Extending the
      // opacity scale here makes `text-ink/94` etc. resolve via the
      // standard slash-opacity syntax instead of needing arbitrary-value
      // brackets at every call site.
      opacity: {
        10: "0.10", 12: "0.12", 22: "0.22", 26: "0.26",
        42: "0.42", 46: "0.46", 66: "0.66", 85: "0.85",
        94: "0.94", 96: "0.96",
      },
      colors: {
        // ── Dusk atmosphere (atlas + agent + mission — pre-aurora) ──
        // Three black-blacks. `bg` matches Three.js scene clear color so
        // HTML overlays + 3D canvas appear continuous.
        bg: "#04050A",
        "bg-deep": "#02030A",
        panel: "#0A0B12",
        "panel-raised": "#10121C",
        line: "#1A1C26",
        divider: "#262838",

        // ── Cream paper atmosphere (landing + claim) ──
        // Warm uncoated paper. Foreground is dusk-navy ink at four alpha
        // rungs; never a flat grey hex.
        //
        // Colors used with slash-opacity syntax (`text-ink/94`, `text-bone/66`)
        // MUST be expressed in the `rgb(R G B / <alpha-value>)` form rather
        // than as hex strings. Tailwind 3's slash-opacity resolver only
        // substitutes the alpha placeholder when the value already supports
        // it; flat hex tokens get a static `--tw-text-opacity` variable
        // instead and the slash modifier silently no-ops at the call site.
        // See https://tailwindcss.com/docs/customizing-colors#using-css-variables
        cream: { DEFAULT: "#FAF6E8", soft: "#F2EBD3", card: "#FDFAEE" },
        ink: "rgb(10 21 37 / <alpha-value>)",
        bone: "rgb(250 246 232 / <alpha-value>)",

        // Dusk inserts on cream pages (the visual bridge to atlas).
        // Numeric keys 2/3 are non-standard for Tailwind shades but valid;
        // generate `bg-dusk-2`, `bg-dusk-3`.
        dusk: { DEFAULT: "#0A1525", 2: "#0F1B2E", 3: "#16243B" },

        // ── Aurora pigments (canonical, used by landing/claim) ──
        // New semantic names so existing dusk surfaces (which hold
        // legacy `cyan`/`amber` references) keep rendering until the
        // atlas-polish phase migrates them.
        peacock: { DEFAULT: "#2A6F8E", bright: "#7DD3F7", wash: "rgba(42,111,142,0.14)" },
        persimmon: { DEFAULT: "#E89A2C", deep: "#B97614", bright: "#FFB849", wash: "rgba(232,154,44,0.16)" },
        sapphire: { DEFAULT: "#1E3A5F", deep: "#0F2444" },
        rose: { DEFAULT: "#C2546A", bright: "#F0617D" },
        gold: { DEFAULT: "#C09A4D" },

        // ── Atlas region tints (zoom-band semantics) ──
        "r-math": "#6FBFD9",
        "r-ai": "#B59AE5",
        "r-mkt": "#D9847E",
        "r-ash": "#3A3F55",

        // ── Legacy dusk pigments (atlas/agent/mission still reference) ──
        cyan: { DEFAULT: "#00d4aa", dim: "#0a8c70" },
        amber: { DEFAULT: "#ff6b35" },
        cold: "#7DD3F7",
        lavender: "#C7A6FF",
        ash: "#3A3F55",
        warm: "#FF8B5C",
        glow: "#67E8F9",
        error: "#F4525E",
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
