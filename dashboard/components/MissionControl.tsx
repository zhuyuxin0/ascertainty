"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { api, type Bounty, type RaceEvent, type Submission } from "@/lib/api";

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  address: string | null;
  token_id: number | null;
  reputation: number;
  worn_badges?: string[];
  earned_badges?: Array<{ slug: string; emoji: string; name: string }>;
  stats?: {
    attempts: number;
    accepted: number;
    acceptance_rate: number;
    avg_kernel_seconds: number | null;
    fastest_kernel_seconds: number | null;
    settled_count: number;
    domain_tags: Array<{ tag: string; count: number }>;
  };
};

const STATUS_COLORS: Record<string, string> = {
  open: "border-cyan/50 bg-cyan/10 text-cyan",
  submitted: "border-amber/50 bg-amber/10 text-amber",
  challenged: "border-amber bg-amber/20 text-amber",
  settled: "border-cyan bg-cyan/20 text-cyan",
  cancelled: "border-white/30 bg-white/5 text-white/40",
};

export function MissionControl({
  bounty,
  submissions,
  personas,
}: {
  bounty: Bounty;
  submissions: Submission[];
  personas: Persona[];
}) {
  // Derive each persona's race state from race events (live polling) + submissions
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    let since = 0;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.raceEvents(bounty.id, since);
        if (cancelled) return;
        if (res.events.length > 0) {
          setEvents((prev) => [...prev, ...res.events]);
          since = Math.max(...res.events.map((e) => e.id));
        }
        setNow(res.now);
      } catch {
        // silent — keep polling
      }
    };
    tick();
    const iv = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [bounty.id]);

  // Per-persona derived state
  const personaStates = useMemo(() => {
    return personas.map((p) => {
      const addr = (p.address || "").toLowerCase();
      const persSubs = submissions.filter(
        (s) => (s.solver_address || "").toLowerCase() === addr,
      );
      const persEvents = events.filter(
        (e) => (e.solver_address || "").toLowerCase() === addr,
      );
      const lastProgress = persEvents
        .filter((e) => e.event_type === "progress")
        .reduce((max, e) => {
          try {
            const data = JSON.parse(e.data_json || "{}");
            const f =
              typeof data.fraction === "number"
                ? data.fraction
                : typeof data.checkpoint === "number" && data.total
                  ? data.checkpoint / data.total
                  : 0;
            return Math.max(max, f);
          } catch {
            return max;
          }
        }, 0);
      const finished = persEvents.some((e) => e.event_type === "finish");
      const crashed = persEvents.some((e) => e.event_type === "crash");
      const submitted = persSubs.length > 0;
      const accepted = persSubs.some((s) => s.accepted === 1);
      const isWinner =
        bounty.status === "settled" && (bounty.poster || "") !== p.address && submitted && accepted;

      let status: "waiting" | "racing" | "submitted" | "settled" | "rejected" = "waiting";
      if (finished || (bounty.status === "settled" && accepted)) status = "settled";
      else if (crashed && !accepted) status = "rejected";
      else if (submitted && accepted) status = "submitted";
      else if (persEvents.length > 0) status = "racing";

      return {
        persona: p,
        progress: finished ? 1 : lastProgress,
        status,
        submission: persSubs[0],
        isWinner,
      };
    });
  }, [personas, submissions, events, bounty.status, bounty.poster]);

  // Settlement countdown
  const settlement = useMemo(() => {
    if (bounty.status !== "submitted") return null;
    const winnerSub = submissions.find((s) => s.accepted === 1);
    if (!winnerSub) return null;
    const expires = winnerSub.submitted_at + bounty.challenge_window_seconds;
    return {
      remaining: Math.max(0, expires - now),
      total: bounty.challenge_window_seconds,
    };
  }, [bounty, submissions, now]);

  const usdc = (parseInt(bounty.amount_usdc, 10) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  const sortedEvents = [...events].sort((a, b) => b.ts - a.ts).slice(0, 30);

  return (
    <section className="max-w-6xl mx-auto px-6 pt-8 pb-24">
      {/* Mission Control header */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan">
            mission control · live telemetry
          </p>
          <h1 className="font-mono text-3xl mt-1">
            bounty #{bounty.id}
            {bounty.onchain_bounty_id !== null && (
              <span className="text-cyan/50 text-xl ml-3">
                on-chain {bounty.onchain_bounty_id}
              </span>
            )}
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <span
            className={`font-mono text-xs uppercase tracking-widest border px-3 py-1 ${
              STATUS_COLORS[bounty.status] ?? STATUS_COLORS.open
            }`}
          >
            {bounty.status}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-2">
            {usdc} MockUSDC at stake
          </span>
        </div>
      </div>
      <div className="flex justify-end mb-8">
        <Link
          href={`/bounty/${bounty.id}`}
          className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan"
        >
          ← back to bounty evidence
        </Link>
      </div>

      {/* Top row: settlement watch + stake counter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2 border border-line p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
            settlement watch
          </div>
          {settlement ? (
            <SettlementCountdown
              remaining={settlement.remaining}
              total={settlement.total}
            />
          ) : bounty.status === "settled" ? (
            <div className="font-mono text-2xl text-cyan">
              ✓ Settled · {usdc} MockUSDC dispatched
            </div>
          ) : (
            <div className="font-mono text-sm text-white/40">
              awaiting first accepted submission
            </div>
          )}
        </div>
        <div className="border border-line p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
            verifier
          </div>
          <div className="font-mono text-lg text-cyan">Lean v4.10.0</div>
          <div className="font-mono text-[10px] text-white/40 mt-1">
            stdlib · TEE-attested via 0G Compute
          </div>
        </div>
      </div>

      {/* Persona lanes */}
      <div className="space-y-3 mb-10">
        {personaStates.map((s) => (
          <PersonaLane key={s.persona.slug} {...s} />
        ))}
        {personaStates.length === 0 && (
          <div className="border border-line p-6 font-mono text-xs text-white/40 text-center">
            no personas registered
          </div>
        )}
      </div>

      {/* Event ticker */}
      <div className="border border-line">
        <div className="border-b border-line px-5 py-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">
            event feed · {events.length} total
          </span>
          <span className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 bg-cyan rounded-full animate-pulse"
              aria-hidden
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
              live
            </span>
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {sortedEvents.length === 0 ? (
            <div className="px-5 py-6 font-mono text-xs text-white/40">
              waiting for events…
            </div>
          ) : (
            sortedEvents.map((e) => (
              <EventRow key={e.id} event={e} personas={personas} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PersonaLane({
  persona,
  progress,
  status,
  submission,
  isWinner,
}: {
  persona: Persona;
  progress: number;
  status: "waiting" | "racing" | "submitted" | "settled" | "rejected";
  submission?: Submission;
  isWinner: boolean;
}) {
  const stats = persona.stats;
  const wornBadges = (persona.earned_badges ?? []).filter((b) =>
    (persona.worn_badges ?? []).includes(b.slug),
  );
  const statusLabel: Record<typeof status, string> = {
    waiting: "idle",
    racing: "racing",
    submitted: "submitted",
    settled: "settled",
    rejected: "kernel rejected",
  };
  const statusColor: Record<typeof status, string> = {
    waiting: "text-white/40",
    racing: "text-amber",
    submitted: "text-amber",
    settled: "text-cyan",
    rejected: "text-amber",
  };

  return (
    <div
      className="border bg-bg/60 backdrop-blur p-4 grid grid-cols-12 gap-4 items-center"
      style={{ borderColor: persona.color + (isWinner ? "" : "60") }}
    >
      {/* Identity */}
      <div className="col-span-12 md:col-span-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          token #{persona.token_id ?? "—"}
          {isWinner && <span className="ml-2 text-cyan">· winner</span>}
        </div>
        <div
          className="font-sans text-xl"
          style={{ color: persona.color }}
        >
          <span className="mr-2">{persona.emoji}</span>
          {persona.name}
        </div>
        {wornBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {wornBadges.map((b) => (
              <span
                key={b.slug}
                title={b.name}
                className="text-base"
                aria-label={b.name}
              >
                {b.emoji}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar + status */}
      <div className="col-span-12 md:col-span-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            proof progress
          </span>
          <span
            className={`font-mono text-[10px] uppercase tracking-widest ${statusColor[status]}`}
          >
            {statusLabel[status]}
          </span>
        </div>
        <div className="h-2 bg-line relative overflow-hidden">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.round(progress * 100)}%`,
              background: persona.color,
              boxShadow: status === "racing" ? `0 0 20px ${persona.color}80` : "none",
            }}
          />
        </div>
        <div className="font-mono text-[10px] tabular-nums text-white/50 flex justify-between">
          <span>{Math.round(progress * 100)}%</span>
          {submission && (
            <span>
              attestation {submission.attestation_hash.slice(0, 12)}…
            </span>
          )}
        </div>
      </div>

      {/* Live stats */}
      <div className="col-span-12 md:col-span-4 grid grid-cols-3 gap-2 text-right md:text-left">
        <Stat
          label="reputation"
          value={persona.reputation.toString()}
          color={persona.color}
        />
        <Stat
          label="accept %"
          value={
            stats && stats.attempts
              ? `${Math.round(stats.acceptance_rate * 100)}%`
              : "—"
          }
          color={persona.color}
        />
        <Stat
          label="kernel"
          value={
            stats?.avg_kernel_seconds != null
              ? `${stats.avg_kernel_seconds.toFixed(2)}s`
              : "—"
          }
          color={persona.color}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SettlementCountdown({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const pct = total > 0 ? 1 - remaining / total : 1;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-3xl text-amber tabular-nums">
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </div>
      <div className="h-1 bg-line">
        <div
          className="h-full bg-amber transition-all"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/50">
        challenge window · auto-claim fires when this hits zero
      </div>
    </div>
  );
}

const EVENT_GLYPH: Record<string, string> = {
  progress: "▸",
  pit: "↻",
  crash: "✗",
  backtrack: "↶",
  finish: "✓",
  submitted: "→",
  challenged: "!",
  claimed: "⨯",
};

function EventRow({
  event,
  personas,
}: {
  event: RaceEvent;
  personas: Persona[];
}) {
  const pers = personas.find(
    (p) =>
      (p.address || "").toLowerCase() === (event.solver_address || "").toLowerCase(),
  );
  const ts = new Date(event.ts * 1000).toISOString().slice(11, 19);
  const glyph = EVENT_GLYPH[event.event_type] ?? "·";
  let detail: string = event.event_type;
  try {
    const data = JSON.parse(event.data_json || "{}");
    if (event.event_type === "progress" && typeof data.fraction === "number") {
      detail = `progress ${Math.round(data.fraction * 100)}%`;
    } else if (event.event_type === "crash") {
      detail = `crash · ${data.reason || "kernel rejected"}`;
    } else if (event.event_type === "finish") {
      detail = `finish · ${data.final_time_seconds || "?"}s`;
    } else if (event.event_type === "pit") {
      detail = `pit · ${data.reason || "refactor"}`;
    } else if (event.event_type === "backtrack") {
      detail = `backtrack to checkpoint ${data.to_checkpoint}`;
    }
  } catch {
    /* ignore */
  }
  return (
    <div className="px-5 py-2 border-b border-line/30 grid grid-cols-12 gap-3 items-center font-mono text-[11px]">
      <span className="col-span-2 text-white/40 tabular-nums">{ts}</span>
      <span
        className="col-span-1 text-base"
        style={{ color: pers?.color ?? "#aaa" }}
        aria-hidden
      >
        {glyph}
      </span>
      <span className="col-span-3" style={{ color: pers?.color ?? "#fff" }}>
        {pers ? `${pers.emoji} ${pers.name}` : event.solver_address.slice(0, 10) + "…"}
      </span>
      <span className="col-span-6 text-white/70">{detail}</span>
    </div>
  );
}
