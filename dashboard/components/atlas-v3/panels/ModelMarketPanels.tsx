"use client";
/* ModelPanel + MarketPanel — entity-detail panels for the AI Models
 * and Prediction Markets regions. */

import { useAtlasV3 } from "@/lib/atlas-v3/state";

import { PanelShell, KV, Section, usePanelOpen } from "./PanelShell";

const SAMPLE_BENCH = [
  ["MMLU-PRO", 94.2],
  ["HUMANEVAL", 92.1],
  ["MATH-500", 88.7],
  ["GPQA-DIA", 71.4],
  ["SWE-BENCH", 62.3],
  ["ARC-AGI", 54.8],
] as const;

export function ModelPanel() {
  const open = usePanelOpen("model");
  const closePanel = useAtlasV3((s) => s.closePanel);

  return (
    <PanelShell open={open} onClose={closePanel} eyebrow="¶ entity · ai model" width={420}>
      <h2 className="font-display italic text-[28px] leading-tight text-ink/94 mb-1">
        claude-sonnet <em className="text-persimmon">4.5</em>
      </h2>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-5">
        anthropic · frontier · 2025-Q4
      </p>

      <Section title="Model metadata">
        <KV k="provider" v={<span className="text-persimmon-deep">Anthropic</span>} />
        <KV k="parameters" v="undisclosed" />
        <KV k="release" v="2025-Q4" />
        <KV k="citations" v="118 cross-domain" />
      </Section>

      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mt-5 mb-2">
        benchmark scores
      </div>
      <div className="flex flex-col gap-2">
        {SAMPLE_BENCH.map(([name, score]) => (
          <div key={name} className="grid grid-cols-[100px_1fr_44px] items-center gap-3 font-mono text-[10px]">
            <span className="uppercase tracking-[0.14em] text-ink/66">{name}</span>
            <div className="h-1.5 bg-ink/10">
              <div className="h-full bg-peacock" style={{ width: `${score}%` }} />
            </div>
            <span className="text-ink/94 tabular-nums text-right">{score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mt-6 mb-2">
        linked arcs
      </div>
      <div className="flex flex-col gap-2">
        <div className="border border-ink/12 bg-cream-card px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink/94">Will Anthropic ship Opus 4.5?</span>
          <span className="text-peacock tabular-nums">94%</span>
        </div>
        <div className="border border-ink/12 bg-cream-card px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink/94">prime-gap −2 lemma · cited</span>
          <span className="text-persimmon tabular-nums">71%</span>
        </div>
      </div>
    </PanelShell>
  );
}

export function MarketPanel() {
  const open = usePanelOpen("market");
  const closePanel = useAtlasV3((s) => s.closePanel);

  return (
    <PanelShell open={open} onClose={closePanel} eyebrow="¶ entity · prediction market" width={420}>
      <h2 className="font-display italic text-[26px] leading-tight text-ink/94 mb-5">
        Will Anthropic ship Opus <em className="text-persimmon">4.5?</em>
      </h2>

      <Section title="Market state">
        <KV k="YES" v={<span className="font-display text-[28px] text-persimmon-deep">87%</span>} />
        <KV k="volume" v="⌥ 14,820" />
        <KV k="deadline" v="2026-Q4" />
        <KV k="source" v={<span className="text-persimmon-deep">Polymarket</span>} />
        <KV k="resolves" v="Binary · yes/no" />
      </Section>

      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mt-5 mb-2">
        linked entities
      </div>
      <div className="flex flex-col gap-2">
        <div className="border border-ink/12 bg-cream-card px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink/94">claude-sonnet-4.5</span>
          <span className="text-peacock tabular-nums">94%</span>
        </div>
        <div className="border border-ink/12 bg-cream-card px-3 py-2 flex items-center justify-between font-mono text-[11px]">
          <span className="text-ink/94">claude-opus-4</span>
          <span className="text-peacock tabular-nums">78%</span>
        </div>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mt-6 mb-2">recent trades</div>
      <div className="flex flex-col">
        {[
          ["YES", "⌥ 240", "4m ago"],
          ["NO", "⌥ 80", "12m ago"],
          ["YES", "⌥ 520", "28m ago"],
          ["YES", "⌥ 180", "1h ago"],
        ].map(([side, amt, t], i) => (
          <div key={i} className="grid grid-cols-[40px_1fr_auto] gap-3 items-baseline py-1.5 border-b border-ink/12 last:border-b-0 font-mono text-[10px]">
            <span className={`uppercase tracking-[0.14em] ${side === "YES" ? "text-peacock" : "text-rose"}`}>{side}</span>
            <span className="text-ink/94 font-display tracking-normal text-[12px]">{amt}</span>
            <span className="text-ink/46 uppercase tracking-[0.14em]">{t}</span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
