"use client";

import { useEffect, useState } from "react";
import type { CarState } from "@/lib/raceEngine";
import type { Bounty } from "@/lib/api";

const STATUS_LABEL: Record<CarState["status"], string> = {
  racing: "racing",
  pitting: "pit",
  crashed: "crashed",
  finished: "finished",
};

export function HUD({
  cars,
  bounty,
  startedAt,
}: {
  cars: CarState[];
  bounty?: Bounty | null;
  startedAt?: number;
}) {
  const sorted = [...cars].sort((a, b) => b.fraction - a.fraction);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    const iv = window.setInterval(() => {
      const ms = Date.now() - startedAt;
      const s = Math.max(0, Math.floor(ms / 1000));
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setElapsed(`${mm}:${ss}`);
    }, 250);
    return () => window.clearInterval(iv);
  }, [startedAt]);

  return (
    <>
      {/* top-right: bounty meta */}
      {bounty && (
        <div className="absolute top-4 right-6 z-10 font-mono text-right pointer-events-none">
          <div className="text-cyan text-sm uppercase tracking-widest">
            {fmtUsdc(bounty.amount_usdc)} MockUSDC
          </div>
          <div className="text-amber/80 text-[9px] uppercase tracking-widest mt-0.5">
            0G Galileo · Testnet
          </div>
          <div className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
            spec {bounty.spec_hash.slice(0, 12)}…
          </div>
          <div className="text-white/40 text-[10px] uppercase tracking-widest">
            status: <span className="text-white/80">{bounty.status}</span>
          </div>
        </div>
      )}

      {/* bottom-right: elapsed clock */}
      <div className="absolute bottom-6 right-6 z-10 font-mono text-cyan text-3xl pointer-events-none tabular-nums">
        {elapsed}
      </div>

      {/* bottom-center: leaderboard strip */}
      {sorted.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3 pointer-events-none">
          {sorted.map((car, i) => (
            <CarChip key={car.solver} car={car} rank={i + 1} />
          ))}
        </div>
      )}

      {/* top-center: camera mode hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] text-white/40 uppercase tracking-widest pointer-events-none">
        [c] camera
      </div>
    </>
  );
}

function CarChip({ car, rank }: { car: CarState; rank: number }) {
  return (
    <div
      className="border border-line bg-bg/80 backdrop-blur px-3 py-2 flex items-center gap-3 min-w-[180px]"
      style={{ borderColor: car.color }}
    >
      <span
        className="w-2 h-2 rounded-none shrink-0"
        style={{ background: car.color }}
      />
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/60 flex justify-between">
          <span>#{rank}{car.simulated && <span className="text-white/30 ml-1">· sim</span>}</span>
          <span>{STATUS_LABEL[car.status]}</span>
        </div>
        <div className="font-mono text-[11px] text-white/80 truncate">
          {car.simulated
            ? "ghost solver"
            : `${car.solver.slice(0, 10)}…${car.solver.slice(-4)}`}
        </div>
        <div className="h-0.5 bg-line mt-1">
          <div
            className="h-full transition-all duration-200 ease-out"
            style={{
              width: `${Math.round(car.fraction * 100)}%`,
              background: car.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function fmtUsdc(raw: string | number): string {
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
