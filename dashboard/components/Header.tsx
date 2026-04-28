import Link from "next/link";

type Active = "bounties" | "leaderboard" | "agent" | null;

export function Header({ active = null }: { active?: Active }) {
  return (
    <header className="border-b border-line">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-2 h-2 bg-cyan rounded-none" />
          <span className="font-mono text-sm tracking-widest uppercase">
            Ascertainty
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest border border-amber/50 bg-amber/10 text-amber px-2 py-0.5">
            0G Galileo · Testnet
          </span>
        </Link>
        <nav className="flex gap-6 font-mono text-xs uppercase tracking-widest text-white/60 items-center">
          <Link
            href="/bounties"
            className={active === "bounties" ? "text-cyan" : "hover:text-cyan"}
          >
            Bounties
          </Link>
          <Link
            href="/leaderboard"
            className={active === "leaderboard" ? "text-cyan" : "hover:text-cyan"}
          >
            Leaderboard
          </Link>
          <Link
            href="/agent"
            className={active === "agent" ? "text-cyan" : "hover:text-cyan"}
          >
            Agent
          </Link>
        </nav>
      </div>
    </header>
  );
}
