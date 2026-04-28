import Link from "next/link";

import { BountyCard } from "@/components/BountyCard";
import { Header } from "@/components/Header";
import { api, type Bounty } from "@/lib/api";

// Always fetch fresh from the backend
export const dynamic = "force-dynamic";

async function loadBounties(): Promise<{ bounties: Bounty[]; error: string | null }> {
  try {
    const res = await api.bounties(50);
    return { bounties: res.bounties, error: null };
  } catch (e) {
    return {
      bounties: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export default async function BountiesPage() {
  const { bounties, error } = await loadBounties();

  return (
    <main className="min-h-screen bg-grid">
      <Header active="bounties" />

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
              live bounties
            </p>
            <h1 className="text-4xl font-light mt-3">
              {bounties.length}{" "}
              <span className="text-white/40">verifiable claims open for solving</span>
            </h1>
          </div>
          <Link
            href="/bounties/new"
            className="border border-cyan text-cyan px-5 py-2 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
          >
            + new bounty
          </Link>
        </div>

        {error ? (
          <div className="border border-amber/40 bg-amber/10 p-6 font-mono text-xs">
            <p className="uppercase tracking-widest text-amber mb-2">backend unreachable</p>
            <p className="text-white/60 break-all">{error}</p>
            <p className="text-white/40 mt-3">
              boot it with <code className="text-cyan">venv/bin/uvicorn backend.main:app --port 8000</code>
            </p>
          </div>
        ) : bounties.length === 0 ? (
          <div className="border border-line p-8 font-mono text-xs uppercase tracking-widest text-white/40 text-center">
            no bounties yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bounties.map((b) => (
              <BountyCard key={b.id} bounty={b} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
