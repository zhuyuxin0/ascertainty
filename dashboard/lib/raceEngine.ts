"use client";

import { useEffect, useRef, useState } from "react";
import { api, type RaceEvent } from "./api";

export type CarStatus = "racing" | "pitting" | "crashed" | "finished";

export type CarState = {
  solver: string;
  color: string;
  /** 0..1 along the centerline */
  fraction: number;
  status: CarStatus;
  /** Active wobble (set after backtrack for ~1.5s) */
  wobble: number;
  lastEventTs: number;
  /** True for client-side simulated "ghost" competitors. Real solvers
   *  (with on-chain submissions) are false. The HUD displays a tag. */
  simulated?: boolean;
};

const SOLVER_COLORS = ["#00d4aa", "#ff6b35", "#a855f7", "#f59e0b", "#3b82f6"];

/**
 * useRaceEngine — polls the backend for race events and folds them into
 * a per-car state object. The 3D scene uses cars[*].fraction to position
 * along the procedural track, status to switch animations, and wobble
 * to apply transient camera shake / chassis tilt.
 *
 * Polling cadence: 500ms is the right tradeoff for the demo — fast
 * enough to feel live, slow enough to stay cheap on backend + battery.
 */
export function useRaceEngine(bountyId: number) {
  const [cars, setCars] = useState<Record<string, CarState>>({});
  const [latestEvents, setLatestEvents] = useState<RaceEvent[]>([]);
  const sinceRef = useRef(0);
  const colorIdxRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    sinceRef.current = 0;
    setCars({});

    async function poll() {
      try {
        const res = await api.raceEvents(bountyId, sinceRef.current);
        if (cancelled) return;
        if (res.events.length > 0) {
          sinceRef.current = res.events[res.events.length - 1].ts;
          setLatestEvents(res.events);
          setCars((prev) => applyEvents(prev, res.events, colorIdxRef));
        }
      } catch (e) {
        // swallow — backend may be down briefly; next tick will retry
      }
    }

    poll();
    const handle = window.setInterval(poll, 500);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [bountyId]);

  // Decay wobble over time even when no events arrive
  useEffect(() => {
    const handle = window.setInterval(() => {
      setCars((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k].wobble > 0.01) {
            next[k] = { ...next[k], wobble: next[k].wobble * 0.85 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 100);
    return () => window.clearInterval(handle);
  }, []);

  return { cars, latestEvents };
}

function applyEvents(
  prev: Record<string, CarState>,
  events: RaceEvent[],
  colorIdxRef: React.MutableRefObject<number>,
): Record<string, CarState> {
  const next = { ...prev };
  for (const ev of events) {
    const data = ev.data_json ? safeParse(ev.data_json) : {};
    const existing = next[ev.solver_address];
    const car: CarState = existing
      ? { ...existing }
      : {
          solver: ev.solver_address,
          color: SOLVER_COLORS[colorIdxRef.current++ % SOLVER_COLORS.length],
          fraction: 0,
          status: "racing",
          wobble: 0,
          lastEventTs: ev.ts,
        };

    car.lastEventTs = ev.ts;
    switch (ev.event_type) {
      case "progress": {
        const f = typeof data.fraction === "number" ? data.fraction : car.fraction;
        car.fraction = Math.max(car.fraction, Math.min(1, f));
        if (car.status === "pitting") car.status = "racing";
        break;
      }
      case "backtrack": {
        const ck = typeof data.to_checkpoint === "number" ? data.to_checkpoint : 0;
        car.fraction = Math.max(0, Math.min(car.fraction, ck / 10));
        car.wobble = 1.0;
        break;
      }
      case "pit": {
        car.status = "pitting";
        break;
      }
      case "crash": {
        car.status = "crashed";
        car.wobble = 1.0;
        break;
      }
      case "finish": {
        car.status = "finished";
        car.fraction = 1;
        break;
      }
    }
    next[ev.solver_address] = car;
  }
  return next;
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

const GHOST_COLORS = ["#8b5cf6", "#f59e0b"]; // purple + amber-orange
const GHOST_ADDRESSES = [
  "0xGH05T0000000000000000000000000000000A001",
  "0xGH05T0000000000000000000000000000000B002",
];

/**
 * Augment the real-solver car set with deterministic "ghost" competitors
 * for visual richness during the demo. A bounty's contract today only
 * permits one solver, so the live race set has at most one car — adding
 * two ghost cars makes the scene feel like the multi-solver future.
 *
 * Ghosts only appear when at least one REAL car exists (so empty bounties
 * don't show fake activity), and never finish ahead of the real lead
 * car (so they read as competitors, not winners).
 *
 * Each ghost has `simulated: true` so the HUD can clearly tag them.
 */
export function withGhostSolvers(
  realCars: CarState[],
  bountyId: number,
): CarState[] {
  if (realCars.length === 0) return realCars;
  const lead = realCars.reduce((a, b) => (a.fraction > b.fraction ? a : b));
  // Two ghost cars, deterministically offset behind the leader
  const ghosts: CarState[] = GHOST_ADDRESSES.map((addr, i) => {
    const offset = (i + 1) * 0.07; // ghost 0 is 7% behind, ghost 1 is 14% behind
    const wiggle = Math.sin(Date.now() * 0.0008 + bountyId * 1.7 + i * 2.1) * 0.02;
    const f = Math.max(0, Math.min(0.85, lead.fraction - offset + wiggle));
    return {
      solver: addr,
      color: GHOST_COLORS[i],
      fraction: f,
      status: "racing",
      wobble: 0,
      lastEventTs: Math.floor(Date.now() / 1000),
      simulated: true,
    };
  });
  return [...realCars, ...ghosts];
}
