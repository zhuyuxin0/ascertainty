"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import RaceCanvas from "@/components/RaceCanvas";
import { HUD } from "@/components/HUD";
import { api, type Bounty } from "@/lib/api";
import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

// Debug overlays — only loaded when ?debug=1
const DebugOverlay = dynamic(
  () => import("@/components/DebugOverlay").then((m) => m.DebugOverlay),
  { ssr: false },
);

export default function RaceForBountyPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const bountyId = parseInt(params.bountyId, 10);
  const search = useSearchParams();
  const debug = search?.get("debug") === "1";
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [cars, setCars] = useState<CarState[]>([]);
  const [_track, setTrack] = useState<TrackGeometry | null>(null);
  const [startedAt] = useState<number>(Date.now());
  const [personas, setPersonas] = useState<Record<string, { name: string; emoji: string; color: string }>>({});

  useEffect(() => {
    if (Number.isNaN(bountyId)) return;
    api
      .bountyStatus(bountyId)
      .then((res) => setBounty(res.bounty))
      .catch(() => setBounty(null));
    // Fetch persona roster for solver-name resolution in HUD + leaderboard
    fetch(`${api.base}/agent/personas`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const map: Record<string, { name: string; emoji: string; color: string }> = {};
        for (const p of data.personas ?? []) {
          if (p.address) {
            map[p.address.toLowerCase()] = {
              name: p.name,
              emoji: p.emoji,
              color: p.color,
            };
          }
        }
        setPersonas(map);
      })
      .catch(() => {});
  }, [bountyId]);

  if (Number.isNaN(bountyId)) {
    return (
      <main className="h-screen grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
        invalid bounty id
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden">
      <RaceCanvas
        className="absolute inset-0"
        mode="replay"
        bountyId={bountyId}
        specYaml={bounty?.spec_yaml ?? undefined}
        onState={(s) => {
          setCars(s.cars);
          setTrack(s.track);
        }}
      />

      <div className="absolute top-4 left-6 z-10 flex items-center gap-4 pointer-events-none">
        <Link
          href="/bounties"
          className="font-mono text-xs uppercase tracking-widest text-white/60 hover:text-cyan pointer-events-auto"
        >
          ← bounties
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-white/30">
          /
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-cyan/80">
          bounty #{bountyId} · live race
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await api.restartRace(bountyId, 180);
              window.location.reload();
            } catch (e) {
              console.error("restart failed", e);
            }
          }}
          className="ml-4 border border-cyan/50 text-cyan px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors pointer-events-auto"
        >
          ↺ restart race
        </button>
      </div>

      <HUD cars={cars} bounty={bounty} startedAt={startedAt} personas={personas} />

      {cars.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] text-white/40 uppercase tracking-widest pointer-events-none animate-pulse">
          waiting for solvers…
        </div>
      )}

      {debug && <DebugOverlay />}
    </main>
  );
}
