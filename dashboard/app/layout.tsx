import type { Metadata } from "next";
import { JetBrains_Mono, Inter, Instrument_Serif, Space_Mono } from "next/font/google";
import "./globals.css";
import { Web3Providers } from "@/components/Web3Providers";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// New typographic primaries: Instrument Serif for headlines/display,
// Space Mono for data + numerals. JetBrains Mono retained for hash strings.
const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ascertainty — Spatial information browser",
  description:
    "A spatial information browser where epistemic depth is navigable and tradeable. Verified claims, mapped at every level of abstraction.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${inter.variable} ${instrumentSerif.variable} ${spaceMono.variable}`}
    >
      <body className="bg-bg text-white font-sans antialiased">
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
