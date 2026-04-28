"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Polls /stats every 5s and animates the value on change. Used on the
 * landing page hero. Falls back to a placeholder if the backend is
 * unreachable.
 */
export function LiveCounter({
  label,
  hint,
  metric = "bounties",
}: {
  label: string;
  hint: string;
  metric?: "bounties";
}) {
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const stats = await api.stats();
        if (cancelled) return;
        setError(false);
        if (metric === "bounties") setValue(stats.bounties);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    tick();
    const iv = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [metric]);

  return (
    <div className="border-l-2 border-cyan/40 pl-4 flex flex-col gap-1">
      <span className="font-sans text-5xl text-cyan tabular-nums leading-none">
        {error ? "—" : value === null ? "…" : value.toLocaleString()}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-widest text-white/60 mt-1">
        {label}
      </span>
      <span className="font-mono text-[9px] text-white/40">{hint}</span>
    </div>
  );
}
