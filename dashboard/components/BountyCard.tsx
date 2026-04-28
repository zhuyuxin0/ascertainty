import Link from "next/link";

import { TheoremSigil } from "@/components/TheoremSigil";
import type { Bounty } from "@/lib/api";

const STATUS_BG: Record<string, string> = {
  open: "bg-cyan/15 text-cyan border-cyan/40",
  submitted: "bg-amber/15 text-amber border-amber/40",
  challenged: "bg-amber/30 text-amber border-amber",
  settled: "bg-cyan/30 text-cyan border-cyan",
  cancelled: "bg-white/5 text-white/40 border-white/20",
};

const STATUS_TINT: Record<string, string> = {
  open: "#00d4aa",
  submitted: "#ff6b35",
  challenged: "#ff6b35",
  settled: "#00d4aa",
  cancelled: "#666",
};

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const usdcRaw = parseInt(bounty.amount_usdc, 10) / 1_000_000;
  const usdc = usdcRaw.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const deadline = new Date(bounty.deadline_unix * 1000);
  const daysLeft = Math.max(
    0,
    Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const statusClass = STATUS_BG[bounty.status] ?? STATUS_BG.open;
  const sigilColor = STATUS_TINT[bounty.status] ?? "#00d4aa";

  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="border border-line p-5 flex flex-col gap-4 hover:border-cyan/60 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          bounty #{bounty.id}
          {bounty.onchain_bounty_id !== null && (
            <span className="text-cyan/60"> · on-chain {bounty.onchain_bounty_id}</span>
          )}
        </span>
        <div className="flex gap-1.5">
          {bounty.erdos_class === 1 && (
            <span
              className="font-mono text-[10px] uppercase tracking-widest border border-amber bg-amber/15 text-amber px-2 py-0.5"
              title="Novelty + difficulty both rated ≥ 9 by 0G Compute. Long-standing open problem."
            >
              ✨ Research-grade
            </span>
          )}
          <span
            className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${statusClass}`}
          >
            {bounty.status}
          </span>
        </div>
      </div>

      {/* Hero: sigil + big amount */}
      <div className="flex items-center gap-4">
        <TheoremSigil
          hash={bounty.spec_hash}
          color={sigilColor}
          size={72}
          label={`Theorem sigil for bounty ${bounty.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              ⌥
            </span>
            <span className="font-sans text-4xl text-cyan tabular-nums leading-none">
              {usdc}
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">
            MockUSDC · {daysLeft > 0 ? `${daysLeft}d left` : "deadline passed"}
          </div>
        </div>
      </div>

      {/* N/D stats — compact, numerals lead */}
      {(bounty.novelty != null || bounty.difficulty != null) && (
        <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest text-white/40 border-t border-line/40 pt-3">
          <span>
            <span className="text-cyan text-base font-sans tabular-nums mr-1.5">
              {bounty.novelty ?? "—"}
            </span>
            novelty
          </span>
          <span>
            <span className="text-cyan text-base font-sans tabular-nums mr-1.5">
              {bounty.difficulty ?? "—"}
            </span>
            difficulty
          </span>
        </div>
      )}

      {bounty.tee_explanation && (
        <div className="border-l-2 border-cyan/30 pl-3 py-1">
          <div className="font-mono text-[9px] uppercase tracking-widest text-cyan/60 mb-1">
            0G Compute · TEE
          </div>
          <p className="text-xs text-white/70 leading-snug line-clamp-3">
            {bounty.tee_explanation}
          </p>
        </div>
      )}

      <div className="font-mono text-[10px] text-white/40 truncate">
        spec <span className="text-white/70">{bounty.spec_hash.slice(0, 16)}…</span>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/60 group-hover:text-cyan flex items-center gap-2">
        view evidence →
      </div>
    </Link>
  );
}
