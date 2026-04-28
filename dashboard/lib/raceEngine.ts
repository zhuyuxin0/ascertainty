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

/**
 * Augment the real-solver car set with the OTHER personas (the ones who
 * didn't submit to this particular bounty) as visual competitors. The
 * BountyFactory contract today permits only one solver per bounty, so
 * the live race has at most one real car — but having Carl and Bea
 * appear as live competitors in Andy's race tells the right story:
 * three on-chain solver agents are competing for every bounty, the
 * winner just lands the submission.
 *
 * Personas-as-ghosts: each non-leading persona renders with their real
 * on-chain address + persona color, so the HUD's address→persona map
 * surfaces them by name (not as anonymous hex). They're flagged
 * `simulated: true` so the HUD still adds the `sim` indicator —
 * honest about the fact that they didn't submit, just visualised.
 *
 * Falls back to anonymous ghost cars when no persona roster is
 * available (during initial page load before /agent/personas resolves).
 */
type RacePersona = {
  address: string;
  color: string;
};

const FALLBACK_GHOSTS: RacePersona[] = [
  { address: "0xGH05T0000000000000000000000000000000A001", color: "#8b5cf6" },
  { address: "0xGH05T0000000000000000000000000000000B002", color: "#f59e0b" },
];

export function withGhostSolvers(
  realCars: CarState[],
  bountyId: number,
  personas: RacePersona[] = [],
): CarState[] {
  if (realCars.length === 0) return realCars;
  const lead = realCars.reduce((a, b) => (a.fraction > b.fraction ? a : b));
  const realAddrs = new Set(realCars.map((c) => c.solver.toLowerCase()));
  const candidates = (personas.length > 0 ? personas : FALLBACK_GHOSTS).filter(
    (p) => !realAddrs.has(p.address.toLowerCase()),
  );
  const ghosts: CarState[] = candidates.slice(0, 2).map((p, i) => {
    const offset = (i + 1) * 0.07; // 7% then 14% behind the leader
    const wiggle = Math.sin(Date.now() * 0.0008 + bountyId * 1.7 + i * 2.1) * 0.02;
    const f = Math.max(0, Math.min(0.85, lead.fraction - offset + wiggle));
    return {
      solver: p.address,
      color: p.color,
      fraction: f,
      status: "racing",
      wobble: 0,
      lastEventTs: Math.floor(Date.now() / 1000),
      simulated: true,
    };
  });
  return [...realCars, ...ghosts];
}
