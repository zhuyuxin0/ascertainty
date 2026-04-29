"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { api, type Bounty } from "@/lib/api";

/**
 * Slide-in right-side bounties panel.
 *
 * Replaces the route jump to `/bounties`. Stays in /atlas so the cosmos
 * keeps rendering behind. Each row expands inline to show spec + status
 * + USDC + deadline; the deep-dive link to the existing /bounty/[id]
 * page is still available for the full evidence trail, but the common
 * read-only browse never leaves /atlas.
 */
export function BountiesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .bounties(50)
      .then((d) => {
        setBounties(d.bounties);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bounties-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="fixed top-0 right-0 h-full z-30 pointer-events-auto w-[min(440px,92vw)] border-l border-line bg-panel/95 backdrop-blur shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-line/60">
            <div className="flex items-center gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
                bounties
              </p>
              <span className="font-mono text-[10px] tabular-nums text-white/40">
                {bounties.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/bounties/new"
                className="font-mono text-[10px] uppercase tracking-widest border border-cyan text-cyan px-2.5 py-1 hover:bg-cyan hover:text-bg transition-colors"
              >
                + new
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-base text-white/40 hover:text-cyan leading-none"
                aria-label="close panel"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="m-4 border border-amber/40 bg-amber/10 p-3 font-mono text-[11px] text-amber">
                backend unreachable: {error}
              </div>
            ) : bounties.length === 0 ? (
              <div className="m-4 border border-dashed border-line/60 p-6 font-mono text-[11px] text-white/40 text-center">
                no bounties yet
              </div>
            ) : (
              <ul>
                {bounties.map((b) => (
                  <BountyRow
                    key={b.id}
                    b={b}
                    expanded={expanded === b.id}
                    onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BountyRow({
  b,
  expanded,
  onToggle,
}: {
  b: Bounty;
  expanded: boolean;
  onToggle: () => void;
}) {
  const settled = b.status === "settled";
  const submitted = b.status === "submitted";
  const statusColor = settled ? "#00d4aa" : submitted ? "#ff6b35" : "#9aa0b5";
  const usdcDisplay = (() => {
    try {
      const n = Number(b.amount_usdc) / 1e6;
      if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
      return `$${n.toFixed(0)}`;
    } catch {
      return b.amount_usdc;
    }
  })();
  const label = bountyLabel(b);
  const deadline = new Date(b.deadline_unix * 1000);
  const deadlineStr =
    deadline.getTime() === 0
      ? "—"
      : deadline.toISOString().slice(0, 10);

  return (
    <li className="border-b border-line/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-3 text-left hover:bg-white/[0.025] flex items-baseline justify-between gap-3"
      >
        <span className="flex-1 min-w-0">
          <span className="font-mono text-[11px] text-white/85 truncate block">
            {label}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-widest mt-0.5 block"
            style={{ color: statusColor }}
          >
            {b.status} · diff {b.difficulty ?? "—"}
            {b.erdos_class === 1 && (
              <span className="text-amber"> · ✨ erdős</span>
            )}
          </span>
        </span>
        <span className="font-mono text-[12px] text-white tabular-nums shrink-0">
          {usdcDisplay}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-3 pt-0 space-y-2 font-mono text-[10px]">
              <Row label="poster">
                <span className="font-hash text-white/70">
                  {short(b.poster, 8, 6)}
                </span>
              </Row>
              <Row label="deadline">
                <span className="text-white/70">{deadlineStr}</span>
              </Row>
              {b.spec_hash && (
                <Row label="spec hash">
                  <span className="font-hash text-white/60">
                    {short(b.spec_hash, 10, 6)}
                  </span>
                </Row>
              )}
              {b.tee_explanation && (
                <div className="pt-2 border-t border-line/40 text-[10px] text-white/55 leading-relaxed">
                  <span className="text-cyan/70 uppercase tracking-widest mr-1">
                    0G compute:
                  </span>
                  {b.tee_explanation.slice(0, 220)}
                  {b.tee_explanation.length > 220 ? "…" : ""}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Link
                  href={`/bounty/${b.id}`}
                  className="border border-cyan text-cyan px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
                >
                  evidence ↗
                </Link>
                <Link
                  href={`/mission/${b.id}`}
                  className="border border-line text-white/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:border-cyan hover:text-cyan transition-colors"
                >
                  telemetry
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 items-baseline">
      <span className="text-white/35 uppercase tracking-widest text-[9px]">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}

function bountyLabel(b: Bounty): string {
  if (b.spec_yaml) {
    const m = /bounty_id:\s*([^\s]+)/.exec(b.spec_yaml);
    if (m) return m[1];
  }
  return `bounty #${b.id}`;
}

function short(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
