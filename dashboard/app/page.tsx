import Link from "next/link";
import SceneCanvas from "@/components/SceneCanvas";
import { LiveCounter } from "@/components/LiveCounter";
import { Header } from "@/components/Header";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-grid relative overflow-hidden">
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-32 flex flex-col gap-12">
        <div className="flex flex-col gap-6 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
            Verification oracle · 0G Galileo testnet · ETHGlobal Open Agents 2026
          </p>
          <h1 className="text-5xl md:text-7xl font-sans font-light leading-[1.05]">
            Where proofs <span className="text-cyan">pay</span>.
          </h1>
          <p className="text-lg text-white/70 font-sans max-w-2xl leading-relaxed">
            Formal proofs and engineering predictions are verified
            deterministically, settled in <span className="text-cyan">MockUSDC</span>{" "}
            on 0G Galileo testnet, and visualized as real-time 3D racing.
            The verification creates competition. The competition creates
            spectacle. The spectacle creates a market.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-2xl">
          <LiveCounter label="Bounties" hint="all states" metric="bounties" />
          <Stat label="Solved" value="—" hint="cumulative" />
          <Stat label="USDC settled" value="—" hint="lifetime" />
        </div>

        <div className="flex gap-4 mt-4">
          <Link
            href="/bounties"
            className="border border-cyan text-cyan px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
          >
            Browse bounties
          </Link>
          <Link
            href="/leaderboard"
            className="border border-line text-white/70 px-6 py-3 font-mono text-xs uppercase tracking-widest hover:border-white/40 hover:text-white"
          >
            Leaderboard
          </Link>
        </div>

        <div className="mt-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40 mb-4">
            ↓ live scene preview
          </p>
          <SceneCanvas className="w-full h-[480px] border border-line bg-bg" />
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border-l-2 border-cyan/40 pl-4 flex flex-col gap-1">
      <span className="font-sans text-5xl text-cyan tabular-nums leading-none">
        {value}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-widest text-white/60 mt-1">
        {label}
      </span>
      <span className="font-mono text-[9px] text-white/40">{hint}</span>
    </div>
  );
}
