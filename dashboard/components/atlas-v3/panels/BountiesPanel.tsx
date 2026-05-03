"use client";
/* BountiesPanel — open theorems board.
 *
 * Reverse-chrono list of bounties from /bounties. Each row shows
 * filing id, theorem signature short, status pill, USDC amount, time
 * indicator. Click any row → routes to /bounty/[id] (the cream-paper
 * proceedings doc), closing the panel + atlas. */

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { API_URL, type Bounty } from "@/lib/api";

import { PanelShell, usePanelOpen } from "./PanelShell";

const STATUS_PILL: Record<string, { label: string; tone: "peacock" | "persimmon" | "rose" | "neutral" }> = {
  open: { label: "open", tone: "peacock" },
  submitted: { label: "submitted", tone: "persimmon" },
  challenged: { label: "challenged", tone: "rose" },
  settled: { label: "settled", tone: "peacock" },
  cancelled: { label: "cancelled", tone: "neutral" },
};

const TONE: Record<string, string> = {
  peacock: "border-peacock bg-peacock/10 text-peacock",
  persimmon: "border-persimmon bg-persimmon/10 text-persimmon",
  rose: "border-rose bg-rose/10 text-rose",
  neutral: "border-ink/22 bg-ink/10 text-ink/66",
};

const fmtUsdc = (raw: string | number) => {
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Math.round(n / 1_000_000).toLocaleString();
};

function extractTheorem(yaml?: string): string {
  if (!yaml) return "";
  const m = yaml.match(/theorem_signature:\s*["']?([^"'\n]+)/);
  return m?.[1]?.trim() ?? "";
}

export function BountiesPanel() {
  const open = usePanelOpen("bounties");
  const closePanel = useAtlasV3((s) => s.closePanel);
  const [bounties, setBounties] = useState<Bounty[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/bounties?limit=50`)
      .then((r) => r.json())
      .then((d) => setBounties(d.bounties ?? []))
      .catch(() => setBounties([]));
  }, [open]);

  return (
    <PanelShell open={open} onClose={closePanel} eyebrow="¶ vol. iv · bounty board" width={460}>
      <h2 className="font-display italic text-[28px] leading-tight text-ink/94 mb-2">
        open <em className="text-persimmon">theorems</em>.
      </h2>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-5">
        {bounties.length} bounties · math-proofs region
      </p>

      {bounties.length === 0 ? (
        <div className="border border-dashed border-ink/22 p-6 font-mono text-[10px] uppercase tracking-widest text-ink/46 text-center">
          board empty · awaiting first filing
        </div>
      ) : (
        <div className="flex flex-col">
          {bounties.map((b) => {
            const theorem = extractTheorem(b.spec_yaml) || `Bounty #${b.id}`;
            const tone = STATUS_PILL[b.status] ?? STATUS_PILL.open;
            return (
              <Link
                key={b.id}
                href={`/bounty/${b.id}`}
                onClick={closePanel}
                className="border-b border-ink/12 last:border-b-0 px-1 py-3 hover:bg-ink/[0.03] transition-colors flex flex-col gap-1.5 group"
              >
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span className="text-ink/66">
                    #{String(b.onchain_bounty_id ?? b.id).padStart(4, "0")}
                  </span>
                  <span className={`border px-1.5 py-0 ${TONE[tone.tone]}`}>{tone.label}</span>
                </div>
                <div className="font-display text-[16px] leading-snug text-ink/94 group-hover:text-peacock transition-colors">
                  {theorem.length > 56 ? theorem.slice(0, 54) + "…" : theorem}
                </div>
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink/46">
                  <span>diff {b.difficulty ?? "—"}</span>
                  <span>
                    <span className="font-display text-[13px] tracking-normal normal-case text-peacock">
                      ⌥ {fmtUsdc(b.amount_usdc)}
                    </span>
                    <span className="ml-1">view evidence →</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}
