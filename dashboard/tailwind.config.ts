import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#030305",
        cyan: { DEFAULT: "#00d4aa", dim: "#0a8c70" },
        amber: { DEFAULT: "#ff6b35" },
        line: "#1a1a22",
        panel: "#0a0a12",
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
