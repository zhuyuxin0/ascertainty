"use client";
/* CourseLive — cream-paper "live race" section for the claim proceedings.
 *
 * Replaces the dark Bruno-Simon-style 3D race scene that used to live at
 * /mission/[bountyId]. Visual identity: cream paper, ink lines, hashed
 * notation. No glow, no fog, no asphalt. The track is a procedurally
 * generated SVG path — depth/breadth/branching/hardness derived from the
 * bounty's complexity rubric (see lib/raceTrack2d.ts).
 *
 * Three personas race along the same path. Their positions come from the
 * existing /bounty/{id}/race-events stream, polled every 2 s. Each event
 * type maps to a small visual:
 *
 *   progress  → car advances + monospace progress %
 *   backtrack → car wobbles back ~6% with persimmon wobble glyph
 *   pit       → car halts and shows "◯ pit" caption for 8s
 *   crash     → car stops with rose ✕ glyph and persimmon ink splat
 *   finish    → car parks at finish, persimmon "FINIS" ink mark
 *
 * The race box sits between the §02 Evidence section and the §03
 * Settlement section in the proceedings. Layout grid is identical to the
 * other proceedings sections (max-w-1640, px-6 md:px-14). */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { api, type Bounty, type RaceEvent } from "@/lib/api";
import { buildTrack2D, positionAt, specFromBounty, tangentAt, type Pt, type Track2D } from "@/lib/raceTrack2d";
import { SectionHead } from "./ClaimSections";

type Persona = {
  slug: string;
  name: string;
  short: string;
  color: string;
  glyph: string;
};

// Stable demo roster — three personas that show up in seeded races.
// Real backend persona data is keyed by address; we look up addresses
// from race events and assign each unique address to one of these slots
// in the order they appear.
const PERSONAS: Persona[] = [
  { slug: "andy", name: "Aggressive Andy", short: "ANDY", color: "#C76A2B", glyph: "▲" },
  { slug: "carl", name: "Careful Carl",    short: "CARL", color: "#2A7A8F", glyph: "◆" },
  { slug: "bea",  name: "Balanced Bea",    short: "BEA",  color: "#7B5BA8", glyph: "●" },
];

type CarState = {
  persona: Persona;
  address: string;
  progress: number;        // 0..1
  status: "racing" | "pit" | "crashed" | "finished";
  lastEventGlyph: string;  // small caption shown in HUD row
  lastEventAt: number;     // timestamp for "since" polling
};

export function CourseLive({ bounty }: { bounty: Bounty }) {
  const spec = useMemo(() => specFromBounty(bounty), [bounty]);
  const track = useMemo(() => buildTrack2D(spec), [spec]);
  const [cars, setCars] = useState<Map<string, CarState>>(new Map());
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const sinceRef = useRef(0);
  const addressOrderRef = useRef<string[]>([]);

  // Tick clock once a second so the "elapsed" caption updates without
  // pulling new events.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll race events. Backend gates events by ts so a 90s seed plays out
  // in real time — we just append whatever it returns.
  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function pull() {
      try {
        const resp = await api.raceEvents(bounty.id, sinceRef.current);
        if (cancelled) return;
        const events = resp.events;
        if (events.length > 0) {
          sinceRef.current = Math.max(...events.map((e) => e.ts));
          setCars((prev) => applyEvents(prev, events, addressOrderRef.current));
        }
      } catch {
        // backend may be unreachable — keep silent, the section still
        // renders with whatever cars we already know about.
      }
      if (!cancelled) timer = setTimeout(pull, 2000);
    }
    pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bounty.id]);

  const carList = Array.from(cars.values());
  const elapsed = bounty.created_at ? now - bounty.created_at : 0;

  return (
    <section className="border-b border-ink/12 py-16">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <SectionHead
          num="§ 03"
          title={<>The <em>course</em>, generated.</>}
          right={
            <p className="font-sans text-[13px] text-ink/66 max-w-sm">
              the spec's dependency depth, branching, and hardness are
              compiled into the track itself. provers race the same path —
              the <em>shape</em> of the proof becomes the shape of the run.
            </p>
          }
        />

        <CourseStatsStrip spec={spec} length={track.length} elapsedSeconds={elapsed} />

        <div className="mt-8 border border-ink/22 bg-cream-card relative">
          <CoursePlate track={track} cars={carList} />
        </div>

        <CourseRoster cars={carList} />
      </div>
    </section>
  );
}

function CourseStatsStrip({ spec, length, elapsedSeconds }: { spec: ReturnType<typeof specFromBounty>; length: number; elapsedSeconds: number }) {
  const items: Array<[string, string]> = [
    ["depth",     `${spec.depth} / 10`],
    ["breadth",   `${spec.breadth}`],
    ["branchings", `${spec.branching}`],
    ["hardness",  `${Math.round(spec.hardness * 100)}%`],
    ["course",    `${Math.round(length)}u`],
    ["elapsed",   formatElapsed(elapsedSeconds)],
  ];
  return (
    <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-ink/12 bg-cream-card/60">
      {items.map(([k, v], i) => (
        <div
          key={k}
          className={`px-4 py-3 ${i < items.length - 1 ? "border-b sm:border-b lg:border-b-0 lg:border-r border-ink/12" : ""}`}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/46">{k}</div>
          <div className="mt-1 font-display text-[20px] tracking-normal text-ink/94">{v}</div>
        </div>
      ))}
    </div>
  );
}

/** The actual SVG plate — paper, ink track, fork glyphs, finish, cars. */
function CoursePlate({ track, cars }: { track: Track2D; cars: CarState[] }) {
  return (
    <svg
      viewBox={`0 0 ${track.viewBox.w} ${track.viewBox.h}`}
      className="block w-full h-auto"
      style={{ maxHeight: 420 }}
      role="img"
      aria-label="procedurally generated proof course"
    >
      {/* Paper grain — subtle ink dots */}
      <defs>
        <pattern id="grain" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="0.4" fill="rgba(10,21,37,0.05)" />
          <circle cx="9" cy="10" r="0.3" fill="rgba(10,21,37,0.04)" />
        </pattern>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(10,21,37,0.08)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width={track.viewBox.w} height={track.viewBox.h} fill="url(#grain)" />

      {/* Track shadow band — slightly thicker, lower opacity */}
      <path
        d={track.d}
        fill="none"
        stroke="rgba(10,21,37,0.10)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Track ink line */}
      <path
        d={track.d}
        fill="none"
        stroke="rgba(10,21,37,0.7)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Centre dashed mid-line */}
      <path
        d={track.d}
        fill="none"
        stroke="#C76A2B"
        strokeOpacity="0.5"
        strokeWidth="0.8"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />

      {/* Spawn marker — left vertical bar */}
      <Marker p={track.spawn} label="SPAWN" tone="ink" />
      {/* Finish marker — right serif "FINIS" */}
      <FinishMark p={track.finish} />

      {/* Branch glyphs along the path — small open diamonds with caption */}
      {track.forks.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <rect x="-4" y="-4" width="8" height="8" transform="rotate(45)" fill="none" stroke="#2A7A8F" strokeWidth="1" />
          <text
            x="0"
            y="-12"
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
            fontSize="8"
            fill="#2A7A8F"
            opacity="0.8"
            style={{ letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            FORK · {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}

      {/* Cars */}
      {cars.map((c) => (
        <Car key={c.address} track={track} car={c} />
      ))}
    </svg>
  );
}

function Marker({ p, label, tone }: { p: Pt; label: string; tone: "ink" | "persimmon" }) {
  const stroke = tone === "ink" ? "rgba(10,21,37,0.7)" : "#C76A2B";
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <line x1="0" y1="-22" x2="0" y2="22" stroke={stroke} strokeWidth="1.2" />
      <text
        x="0"
        y="-30"
        textAnchor="middle"
        fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
        fontSize="9"
        fill={stroke}
        style={{ letterSpacing: "0.22em" }}
      >
        {label}
      </text>
    </g>
  );
}

function FinishMark({ p }: { p: Pt }) {
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <line x1="0" y1="-26" x2="0" y2="26" stroke="#C76A2B" strokeWidth="1.5" />
      <line x1="-4" y1="-26" x2="-4" y2="26" stroke="#C76A2B" strokeWidth="0.8" strokeOpacity="0.6" />
      <line x1="4" y1="-26" x2="4" y2="26" stroke="#C76A2B" strokeWidth="0.8" strokeOpacity="0.6" />
      <text
        x="14"
        y="6"
        fontFamily="var(--font-fraunces), serif"
        fontStyle="italic"
        fontSize="22"
        fill="#C76A2B"
      >
        FINIS
      </text>
    </g>
  );
}

function Car({ track, car }: { track: Track2D; car: CarState }) {
  const pos = positionAt(track, car.progress);
  // Wobble derived from event type — pit/crash sit still, racing pulses
  // very slightly so the eye registers them as alive even with no events.
  const wobble = car.status === "racing" ? 1 : 0;
  const angle = (tangentAt(track, car.progress) * 180) / Math.PI;
  const tone = car.persona.color;
  const finished = car.status === "finished";

  return (
    <motion.g
      initial={false}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", damping: 22, stiffness: 90 }}
    >
      {/* Persona name above */}
      <text
        x="0"
        y="-22"
        textAnchor="middle"
        fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
        fontSize="8.5"
        fill="rgba(10,21,37,0.94)"
        style={{ letterSpacing: "0.22em", textTransform: "uppercase" }}
      >
        {car.persona.short} · {Math.round(car.progress * 100)}%
      </text>

      {/* Car body — small filled triangle pointing along the track. */}
      <g transform={`rotate(${angle})`}>
        <motion.polygon
          points="-7,-5 -7,5 7,0"
          fill={tone}
          stroke="rgba(10,21,37,0.5)"
          strokeWidth="0.6"
          animate={
            car.status === "crashed"
              ? { rotate: [0, -12, 12, -8, 8, 0], opacity: [1, 0.7] }
              : car.status === "pit"
              ? { opacity: [0.6, 1, 0.6] }
              : { y: [0, -wobble, 0, wobble, 0] }
          }
          transition={
            car.status === "crashed"
              ? { duration: 0.6 }
              : car.status === "pit"
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </g>

      {/* Last-event glyph below */}
      {car.lastEventGlyph && (
        <text
          x="0"
          y="20"
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), ui-monospace, monospace"
          fontSize="10"
          fill={car.status === "crashed" ? "#B85A42" : car.status === "finished" ? "#C76A2B" : tone}
          opacity="0.85"
        >
          {car.lastEventGlyph}
        </text>
      )}

      {/* Finish flourish */}
      {finished && (
        <motion.circle
          cx="0"
          cy="0"
          r="8"
          fill="none"
          stroke="#C76A2B"
          strokeWidth="1.2"
          initial={{ r: 8, opacity: 1 }}
          animate={{ r: 22, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
}

function CourseRoster({ cars }: { cars: CarState[] }) {
  if (cars.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-ink/22 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/66">
          awaiting first prover · the track is drawn, the line is open.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12 border border-ink/12">
      {cars.map((c) => (
        <div key={c.address} className="bg-cream-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: c.persona.color }}
            >
              {c.persona.glyph} {c.persona.short}
            </span>
            <span className="font-hash text-[11px] text-ink/66 normal-case tracking-normal">
              {short(c.address)}
            </span>
          </div>
          <div className="font-display text-[28px] leading-none text-ink/94">
            {Math.round(c.progress * 100)}%
          </div>
          <div className="mt-2 h-[3px] bg-ink/12 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${Math.max(2, Math.round(c.progress * 100))}%`, background: c.persona.color }}
            />
          </div>
          <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/46">
            {statusLabel(c.status)} · {c.lastEventGlyph}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- event reducer + helpers ---------- */

function applyEvents(prev: Map<string, CarState>, events: RaceEvent[], order: string[]): Map<string, CarState> {
  const next = new Map(prev);
  for (const ev of events) {
    let car = next.get(ev.solver_address);
    if (!car) {
      // Assign a persona slot in first-seen order
      if (!order.includes(ev.solver_address)) order.push(ev.solver_address);
      const slot = order.indexOf(ev.solver_address) % PERSONAS.length;
      car = {
        persona: PERSONAS[slot],
        address: ev.solver_address,
        progress: 0,
        status: "racing",
        lastEventGlyph: "▲ on the line",
        lastEventAt: ev.ts,
      };
    }
    const data = parseData(ev.data_json);
    switch (ev.event_type) {
      case "progress": {
        const p = typeof data.progress === "number" ? data.progress : car.progress;
        car = { ...car, progress: clamp01(p), status: "racing", lastEventGlyph: `▲ ${Math.round(p * 100)}%`, lastEventAt: ev.ts };
        break;
      }
      case "backtrack":
        car = { ...car, progress: clamp01(car.progress - 0.06), lastEventGlyph: "↶ backtrack", lastEventAt: ev.ts };
        break;
      case "pit":
        car = { ...car, status: "pit", lastEventGlyph: "◯ pit · refactor", lastEventAt: ev.ts };
        break;
      case "crash":
        car = { ...car, status: "crashed", lastEventGlyph: "✕ kernel rejected", lastEventAt: ev.ts };
        break;
      case "finish":
        car = { ...car, progress: 1, status: "finished", lastEventGlyph: "✓ FINIS · settled", lastEventAt: ev.ts };
        break;
    }
    next.set(ev.solver_address, car);
  }
  return next;
}

function parseData(s: string | null): { progress?: number; [k: string]: unknown } {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function statusLabel(s: CarState["status"]): string {
  switch (s) {
    case "racing":   return "racing";
    case "pit":      return "in pit";
    case "crashed":  return "out · rejected";
    case "finished": return "finished · settled";
  }
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function short(s: string) {
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-4)}`;
}
