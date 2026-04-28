"use client";

import { useState } from "react";

import { API_URL } from "@/lib/api";

type Rating = {
  novelty: number;
  difficulty: number;
  reasoning: string;
  recommendation: "post" | "refine" | "reject";
  erdos_class: boolean;
};

type Duplicate = {
  bounty_id: number;
  similarity: number;
  kind: "exact" | "near";
  theorem: string;
};

type DuplicateResp = {
  duplicates: Duplicate[];
  warning_level: "block" | "warn" | "ok";
};

const REC_COLORS: Record<string, string> = {
  post: "border-cyan/60 bg-cyan/10 text-cyan",
  refine: "border-amber/60 bg-amber/10 text-amber",
  reject: "border-amber bg-amber/30 text-amber",
};

export function BountyAssistant({
  specYaml,
  setSpecYaml,
}: {
  specYaml: string;
  setSpecYaml: (s: string) => void;
}) {
  const [description, setDescription] = useState(
    "Prove that for every prime p > 2, the multiplicative group (ℤ/pℤ)* is cyclic.",
  );
  const [tags, setTags] = useState("number-theory,group-theory");
  const [phase, setPhase] = useState<
    "idle" | "formalizing" | "rating" | "checking"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateResp | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function onFormalize() {
    setError(null);
    setParseError(null);
    setRating(null);
    setDuplicates(null);
    setPhase("formalizing");
    try {
      const res = await fetch(`${API_URL}/bounty/assist/formalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      if (data.spec_yaml) setSpecYaml(data.spec_yaml);
      if (data.parse_error) setParseError(data.parse_error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase("idle");
    }
  }

  async function onRate() {
    setError(null);
    setPhase("rating");
    try {
      const res = await fetch(`${API_URL}/bounty/assist/rate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: specYaml }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as Rating;
      setRating(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase("idle");
    }
  }

  async function onCheckDup() {
    setError(null);
    setPhase("checking");
    try {
      const res = await fetch(`${API_URL}/bounty/assist/check-duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: specYaml }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as DuplicateResp;
      setDuplicates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="border border-cyan/30 bg-cyan/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">
            ai assist · powered by 0g compute (TEE)
          </p>
          <p className="font-mono text-[10px] text-white/50 mt-0.5">
            describe your claim in english → autoformalize to Lean 4 spec → rate novelty + difficulty
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-1">
            claim (plain english)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-bg border border-line text-white font-sans text-sm px-3 py-2 focus:border-cyan focus:outline-none"
            placeholder="e.g. Prove that every continuous function on a closed interval attains its maximum."
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-1">
            tag hints (comma-sep)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full bg-bg border border-line text-white font-mono text-xs px-3 py-2 focus:border-cyan focus:outline-none"
            placeholder="analysis, real-numbers"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFormalize}
          disabled={phase !== "idle" || !description.trim()}
          className="border border-cyan text-cyan px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
        >
          {phase === "formalizing" ? "formalizing…" : "✨ autoformalize"}
        </button>
        <button
          type="button"
          onClick={onRate}
          disabled={phase !== "idle" || !specYaml}
          className="border border-line text-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:border-cyan hover:text-cyan disabled:opacity-50"
        >
          {phase === "rating" ? "rating…" : "rate spec"}
        </button>
        <button
          type="button"
          onClick={onCheckDup}
          disabled={phase !== "idle" || !specYaml}
          className="border border-line text-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:border-cyan hover:text-cyan disabled:opacity-50"
        >
          {phase === "checking" ? "scanning…" : "check duplicates"}
        </button>
      </div>

      {error && (
        <div className="border border-amber/40 bg-amber/10 p-2 font-mono text-[11px] text-amber whitespace-pre-wrap break-words">
          {error}
        </div>
      )}

      {parseError && (
        <div className="border border-amber/40 bg-amber/10 p-2 font-mono text-[11px] text-amber">
          ⚠ LLM output didn't parse cleanly — {parseError}. Edit the YAML below and re-rate.
        </div>
      )}

      {rating && (
        <div className="border border-line p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 items-baseline">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                novelty
              </span>
              <NovDifBar value={rating.novelty} />
            </div>
            <div className="flex gap-3 items-baseline">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                difficulty
              </span>
              <NovDifBar value={rating.difficulty} />
            </div>
            <span
              className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${REC_COLORS[rating.recommendation] ?? REC_COLORS.refine}`}
            >
              {rating.recommendation}
            </span>
          </div>
          {rating.erdos_class && (
            <div className="border border-amber bg-amber/10 px-3 py-2 flex items-center gap-2">
              <span className="text-xl">✨</span>
              <span className="font-sans text-amber text-sm">
                <strong>Erdős-class.</strong> Both novelty and difficulty rate ≥ 9 —
                a research-grade open problem. Posters should expect long-tail
                attempts à la Liam Price / Erdős #1196.
              </span>
            </div>
          )}
          <p className="font-sans text-sm text-white/80 italic">
            {rating.reasoning}
          </p>
        </div>
      )}

      {duplicates && (
        <div className="border border-line p-3 flex flex-col gap-1.5">
          {duplicates.warning_level === "ok" ? (
            <p className="font-mono text-[11px] text-cyan">
              ✓ no near-duplicates found in the existing bounty roster
            </p>
          ) : (
            <>
              <p
                className={`font-mono text-[11px] uppercase tracking-widest ${
                  duplicates.warning_level === "block"
                    ? "text-amber"
                    : "text-amber/80"
                }`}
              >
                {duplicates.warning_level === "block"
                  ? "⛔ exact duplicate — would not deploy"
                  : "⚠ near-duplicate detected"}
              </p>
              {duplicates.duplicates.map((d) => (
                <div
                  key={d.bounty_id}
                  className="font-mono text-[11px] text-white/70 border-l-2 border-amber/40 pl-3"
                >
                  <span className="text-amber">
                    bounty #{d.bounty_id} · {Math.round(d.similarity * 100)}% match
                  </span>
                  <span className="ml-2 text-white/50 truncate inline-block max-w-[480px] align-bottom">
                    {d.theorem}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NovDifBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  const color = value >= 9 ? "#ff6b35" : value >= 6 ? "#00d4aa" : "#777";
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-2xl tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-white/40 text-xs">/ 10</span>
      <span className="block w-16 h-1 bg-line">
        <span
          className="block h-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
    </span>
  );
}
