import Link from "next/link";

import { api, type Solver } from "@/lib/api";

export const dynamic = "force-dynamic";

async function loadLeaderboard(): Promise<{ solvers: Solver[]; error: string | null }> {
  try {
    const res = await api.leaderboard(50);
    return { solvers: res.solvers, error: null };
  } catch (e) {
    return {
      solvers: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function LeaderboardPage() {
  const { solvers, error } = await loadLeaderboard();

  return (
    <main className="min-h-screen bg-grid">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan rounded-none" />
            <span className="font-mono text-sm tracking-widest uppercase">
              Ascertainty
            </span>
          </Link>
          <nav className="flex gap-6 font-mono text-xs uppercase tracking-widest text-white/60">
            <Link href="/bounties" className="hover:text-cyan">Bounties</Link>
            <Link href="/leaderboard" className="text-cyan">Leaderboard</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          solver leaderboard
        </p>
        <h1 className="text-4xl font-light mt-3 mb-12">
          ranked by reputation <span className="text-white/40">— bounty wins compound</span>
        </h1>

        {error ? (
          <div className="border border-amber/40 bg-amber/10 p-6 font-mono text-xs">
            <p className="uppercase tracking-widest text-amber mb-2">backend unreachable</p>
            <p className="text-white/60 break-all">{error}</p>
          </div>
        ) : solvers.length === 0 ? (
          <div className="border border-line p-8 font-mono text-xs uppercase tracking-widest text-white/40 text-center">
            no solvers yet
          </div>
        ) : (
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-3 text-[10px] uppercase tracking-widest text-white/40 w-12">#</th>
                <th className="py-3 text-[10px] uppercase tracking-widest text-white/40">solver</th>
                <th className="py-3 text-[10px] uppercase tracking-widest text-white/40 text-right">solved</th>
                <th className="py-3 text-[10px] uppercase tracking-widest text-white/40 text-right">reputation</th>
                <th className="py-3 text-[10px] uppercase tracking-widest text-white/40 text-right">last active</th>
              </tr>
            </thead>
            <tbody>
              {solvers.map((s, i) => (
                <tr key={s.address} className="border-b border-line/50 hover:bg-cyan/5 transition-colors">
                  <td className="py-3 text-cyan">{i + 1}</td>
                  <td className="py-3">
                    <span className="text-white/80">{s.address.slice(0, 10)}…{s.address.slice(-6)}</span>
                  </td>
                  <td className="py-3 text-right">{s.solved_count}</td>
                  <td className="py-3 text-right text-cyan">{s.reputation}</td>
                  <td className="py-3 text-right text-white/40 text-xs">
                    {s.last_active_ts
                      ? new Date(s.last_active_ts * 1000).toISOString().slice(0, 10)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
