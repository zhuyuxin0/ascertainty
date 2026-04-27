import Link from "next/link";
import type { Bounty } from "@/lib/api";

const STATUS_BG: Record<string, string> = {
  open: "bg-cyan/15 text-cyan border-cyan/40",
  submitted: "bg-amber/15 text-amber border-amber/40",
  challenged: "bg-amber/30 text-amber border-amber",
  settled: "bg-cyan/30 text-cyan border-cyan",
  cancelled: "bg-white/5 text-white/40 border-white/20",
};

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const usdc = (parseInt(bounty.amount_usdc, 10) / 1_000_000).toLocaleString(
    undefined,
    { maximumFractionDigits: 2 },
  );
  const deadline = new Date(bounty.deadline_unix * 1000);
  const daysLeft = Math.max(
    0,
    Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const statusClass = STATUS_BG[bounty.status] ?? STATUS_BG.open;

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
        <span
          className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${statusClass}`}
        >
          {bounty.status}
        </span>
      </div>

      <div>
        <div className="font-mono text-2xl text-cyan">{usdc} USDC</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">
          {daysLeft > 0 ? `${daysLeft}d to deadline` : "deadline passed"}
        </div>
      </div>

      <TrackPreview seed={bounty.id} />

      <div className="font-mono text-[10px] text-white/40 truncate">
        spec <span className="text-white/70">{bounty.spec_hash.slice(0, 16)}…</span>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/60 group-hover:text-cyan flex items-center gap-2">
        view evidence →
      </div>
    </Link>
  );
}

/** Tiny ASCII-art preview of a procedurally-shaped track, deterministic by id. */
function TrackPreview({ seed }: { seed: number }) {
  const rows = 5;
  const cols = 22;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const noise = Math.sin((c + 1) * 0.6 + seed) + Math.cos((r + 1) * 0.8 + seed * 0.3);
      const t = (Math.sin(c * 0.4 + seed) + 1) * 0.5;
      const onPath = Math.abs(r - (rows / 2 + Math.sin(c * 0.5 + seed) * 1.5)) < 0.6;
      if (onPath) line += "━";
      else if (noise > 1.4) line += "·";
      else line += " ";
    }
    lines.push(line);
  }
  return (
    <pre className="font-mono text-[8px] leading-[1.05] text-cyan/50 whitespace-pre">
      {lines.join("\n")}
    </pre>
  );
}
