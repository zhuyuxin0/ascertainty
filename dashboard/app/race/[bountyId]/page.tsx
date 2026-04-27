"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import RaceCanvas from "@/components/RaceCanvas";
import { HUD } from "@/components/HUD";
import { api, type Bounty } from "@/lib/api";
import type { CarState } from "@/lib/raceEngine";
import type { TrackGeometry } from "@/lib/trackMapping";

export default function RaceForBountyPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const bountyId = parseInt(params.bountyId, 10);
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [cars, setCars] = useState<CarState[]>([]);
  const [_track, setTrack] = useState<TrackGeometry | null>(null);
  const [startedAt] = useState<number>(Date.now());

  useEffect(() => {
    if (Number.isNaN(bountyId)) return;
    api
      .bountyStatus(bountyId)
      .then((res) => setBounty(res.bounty))
      .catch(() => setBounty(null));
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
        onState={(s) => {
          setCars(s.cars);
          setTrack(s.track);
        }}
      />

      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between pointer-events-none">
        <Link
          href="/bounties"
          className="font-mono text-xs uppercase tracking-widest text-white/60 hover:text-cyan pointer-events-auto"
        >
          ← bounties
        </Link>
        <div className="font-mono text-xs uppercase tracking-widest text-cyan/80">
          bounty #{bountyId} · live race
        </div>
      </div>

      <HUD cars={cars} bounty={bounty} startedAt={startedAt} />

      {cars.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] text-white/40 uppercase tracking-widest pointer-events-none animate-pulse">
          waiting for solvers…
        </div>
      )}
    </main>
  );
}
