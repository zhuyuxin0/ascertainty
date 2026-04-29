"use client";

import { motion, AnimatePresence } from "framer-motion";

import {
  type AtlasModel,
  type AtlasMarket,
  BENCHMARKS,
  BENCHMARK_LABEL,
  providerColorRGB,
} from "@/lib/atlas/types";

const NOW = Math.floor(Date.now() / 1000);

export function ModelSidePanel({
  model,
  onClose,
}: {
  model: AtlasModel | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {model && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
          className="fixed top-0 right-0 z-30 h-full w-[420px] bg-bg/95 backdrop-blur border-l border-line p-6 overflow-y-auto"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                {model.provider} · {model.family}
              </div>
              <div
                className="font-display text-3xl mt-1"
                style={{
                  color: `rgb(${providerColorRGB(model.provider).join(",")})`,
                }}
              >
                {model.name}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs uppercase tracking-widest text-white/40 hover:text-cyan"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-[11px]">
            <Stat label="aggregate" value={model.aggregate.toFixed(1)} />
            <Stat
              label="freshness"
              value={`${Math.floor((NOW - model.last_updated_unix) / 86400)}d`}
            />
            <Stat
              label="$/M in"
              value={
                model.price_input_mtok != null
                  ? `$${model.price_input_mtok.toFixed(2)}`
                  : "—"
              }
            />
            <Stat
              label="$/M out"
              value={
                model.price_output_mtok != null
                  ? `$${model.price_output_mtok.toFixed(2)}`
                  : "—"
              }
            />
          </div>

          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 mb-3">
              benchmarks
            </div>
            <div className="space-y-2">
              {BENCHMARKS.map((b) => {
                const v = model[b];
                const present = typeof v === "number";
                return (
                  <div key={b} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/50 w-20">
                      {BENCHMARK_LABEL[b]}
                    </span>
                    <div className="flex-1 h-1.5 bg-line">
                      {present && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${v}%`,
                            background: `rgb(${providerColorRGB(model.provider).join(",")})`,
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="font-mono text-xs tabular-nums w-12 text-right"
                      style={{
                        color: present
                          ? `rgb(${providerColorRGB(model.provider).join(",")})`
                          : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {present ? v.toFixed(1) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {model.source_url && (
            <a
              href={model.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-cyan/70 hover:text-cyan underline-offset-4 hover:underline"
            >
              source ↗
            </a>
          )}

          <div className="mt-8 pt-6 border-t border-line">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
              verification class
            </div>
            <p className="font-sans text-xs text-white/60 leading-relaxed">
              Layer 1 · Benchmark-attested. Scores reported by the provider
              and aggregated from public leaderboards. The deeper layer
              (per-question, per-evaluation-run) becomes a Layer 4 drilldown
              at higher zoom.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function MarketSidePanel({
  market,
  onClose,
}: {
  market: AtlasMarket | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {market && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
          className="fixed top-0 right-0 z-30 h-full w-[420px] bg-bg/95 backdrop-blur border-l border-line p-6 overflow-y-auto"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                Polymarket · {market.category}
              </div>
              <div className="font-display text-2xl mt-1 text-cyan leading-tight">
                {market.question}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs uppercase tracking-widest text-white/40 hover:text-cyan"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-[11px]">
            <Stat label="probability" value={`${(market.probability * 100).toFixed(1)}%`} />
            <Stat
              label="volume"
              value={`$${(market.volume_usd / 1e6).toFixed(2)}M`}
            />
            <Stat label="end" value={market.end_date_iso?.slice(0, 10) || "—"} />
            <Stat label="category" value={market.category} />
          </div>

          {market.slug && (
            <a
              href={`https://polymarket.com/event/${market.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-cyan/70 hover:text-cyan underline-offset-4 hover:underline"
            >
              view on polymarket ↗
            </a>
          )}

          <div className="mt-8 pt-6 border-t border-line">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
              verification class
            </div>
            <p className="font-sans text-xs text-white/60 leading-relaxed">
              Layer 2 · Consensus-resolved. Polymarket markets resolve via
              UMA optimistic oracle on the deadline date. Probability is the
              market's current outcome-token price, not a kernel-checked
              truth value.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-line pl-3 py-1">
      <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="font-mono text-sm text-white/85 tabular-nums">{value}</div>
    </div>
  );
}
