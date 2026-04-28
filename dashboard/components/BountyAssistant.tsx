"use client";

import { useState } from "react";

import { API_URL } from "@/lib/api";

type RefineOutcome = "valid" | "refine" | "operationalize" | "reject";

type RefineResp = {
  outcome: RefineOutcome;
  spec_yaml?: string;
  warning?: string;
  rejection_reason?: string;
  suggested_redirect?: string;
  parse_error?: string | null;
  fallback?: boolean;
};

type Rating = {
  novelty: number;
  difficulty: number;
  reasoning: string;
  recommendation: "post" | "refine" | "reject";
  erdos_class: boolean;
  fallback?: boolean;
};

type Duplicate = {
  bounty_id: number;
  similarity: number;
  kind: "exact" | "near";
  theorem: string;
};

type DupResp = {
  duplicates: Duplicate[];
  warning_level: "block" | "warn" | "ok";
};

type StepStatus = "pending" | "running" | "passed" | "failed" | "blocked";

const REC_COLORS: Record<string, string> = {
  post: "border-cyan/60 bg-cyan/10 text-cyan",
  refine: "border-amber/60 bg-amber/10 text-amber",
  reject: "border-amber bg-amber/30 text-amber",
};

export function BountyAssistant({
  specYaml,
  setSpecYaml,
  onUnlocked,
}: {
  specYaml: string;
  setSpecYaml: (s: string) => void;
  onUnlocked: (unlocked: boolean) => void;
}) {
  const [input, setInput] = useState(
    "Prove that for every prime p > 2, the multiplicative group of integers modulo p is cyclic.",
  );
  const [tags, setTags] = useState("number-theory,group-theory");

  const [s1, setS1] = useState<StepStatus>("pending");
  const [s2, setS2] = useState<StepStatus>("pending");
  const [s3, setS3] = useState<StepStatus>("pending");

  const [refine, setRefine] = useState<RefineResp | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [dup, setDup] = useState<DupResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setS1("pending");
    setS2("pending");
    setS3("pending");
    setRefine(null);
    setRating(null);
    setDup(null);
    setError(null);
    onUnlocked(false);
  }

  async function runWizard() {
    reset();
    setError(null);

    // Step 1 — refine
    setS1("running");
    let refineResult: RefineResp;
    try {
      const res = await fetch(`${API_URL}/bounty/assist/refine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: input,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(`refine HTTP ${res.status}: ${await res.text()}`);
      refineResult = (await res.json()) as RefineResp;
      setRefine(refineResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setS1("failed");
      return;
    }

    if (refineResult.outcome === "reject") {
      setS1("failed");
      setS2("blocked");
      setS3("blocked");
      return;
    }
    setS1("passed");
    if (refineResult.spec_yaml) setSpecYaml(refineResult.spec_yaml);

    const yamlForRest = refineResult.spec_yaml ?? specYaml;
    if (refineResult.parse_error) {
      // Spec didn't parse — can't rate or dedup. Show step 1 as passed but
      // gate 2 and 3 until the user fixes the YAML and re-runs.
      setS2("blocked");
      setS3("blocked");
      return;
    }

    // Step 2 — rate
    setS2("running");
    let ratingResult: Rating;
    try {
      const res = await fetch(`${API_URL}/bounty/assist/rate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: yamlForRest }),
      });
      if (!res.ok) throw new Error(`rate HTTP ${res.status}: ${await res.text()}`);
      ratingResult = (await res.json()) as Rating;
      setRating(ratingResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setS2("failed");
      setS3("blocked");
      return;
    }
    if (ratingResult.recommendation === "reject") {
      setS2("failed");
      setS3("blocked");
      return;
    }
    setS2("passed");

    // Step 3 — dedup
    setS3("running");
    try {
      const res = await fetch(`${API_URL}/bounty/assist/check-duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: yamlForRest }),
      });
      if (!res.ok) throw new Error(`dedup HTTP ${res.status}: ${await res.text()}`);
      const dupResult = (await res.json()) as DupResp;
      setDup(dupResult);
      if (dupResult.warning_level === "block") {
        setS3("failed");
        return;
      }
      setS3("passed");
      onUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setS3("failed");
    }
  }

  const stepperColor = (s: StepStatus) =>
    s === "passed"
      ? "border-cyan text-cyan"
      : s === "running"
        ? "border-amber text-amber animate-pulse"
        : s === "failed"
          ? "border-amber bg-amber/20 text-amber"
          : s === "blocked"
            ? "border-line/30 text-white/30"
            : "border-line text-white/50";

  const wizardRunning = s1 === "running" || s2 === "running" || s3 === "running";

  return (
    <div className="border border-cyan/30 bg-cyan/5 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">
            ai assist · powered by 0g compute (TEE)
          </p>
          <p className="font-mono text-[10px] text-white/50 mt-0.5">
            describe your claim → agent refines, rates, dedups, then unlocks the spec for posting
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["1 · refine", s1, "Lean-formalize or honestly reject"],
            ["2 · rate", s2, "novelty + difficulty + recommendation"],
            ["3 · dedup", s3, "scan for existing on-chain dupes"],
          ] as const
        ).map(([label, st, sub]) => (
          <div
            key={label}
            className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-widest flex flex-col gap-0.5 ${stepperColor(st)}`}
          >
            <span>{label}</span>
            <span className="text-white/40 normal-case text-[9px]">{sub}</span>
            <span className="text-[9px] mt-1">
              {st === "passed" && "✓ passed"}
              {st === "running" && "running…"}
              {st === "failed" && "✗ blocked"}
              {st === "blocked" && "⊘ skipped"}
              {st === "pending" && "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-1">
            claim (plain english OR pasted YAML)
          </label>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (s1 !== "pending") reset();
            }}
            rows={4}
            className="w-full bg-bg border border-line text-white font-sans text-sm px-3 py-2 focus:border-cyan focus:outline-none"
            placeholder='e.g. "Prove that every continuous function on a closed interval attains its maximum."'
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

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={runWizard}
          disabled={wizardRunning || !input.trim()}
          className="border border-cyan text-cyan px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
        >
          {wizardRunning ? "running wizard…" : "✨ refine & validate"}
        </button>
        {(s1 === "passed" || s1 === "failed") && (
          <button
            type="button"
            onClick={reset}
            disabled={wizardRunning}
            className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70"
          >
            reset
          </button>
        )}
      </div>

      {error && (
        <div className="border border-amber/40 bg-amber/10 p-2 font-mono text-[11px] text-amber whitespace-pre-wrap break-words">
          {error}
        </div>
      )}

      {/* Step 1 outcome */}
      {refine && (
        <div className="border border-line p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
              step 1 · {refine.outcome}
              {refine.fallback && (
                <span className="text-amber/80 ml-2">· heuristic mode</span>
              )}
            </span>
          </div>
          {refine.outcome === "valid" && (
            <p className="font-sans text-sm text-cyan">
              ✓ Input was already a parseable spec — going straight to rating.
            </p>
          )}
          {refine.outcome === "refine" && (
            <p className="font-sans text-sm text-white/80">
              ✓ Translated to Lean 4. Spec drafted below.
            </p>
          )}
          {refine.outcome === "operationalize" && refine.warning && (
            <div className="border-l-2 border-amber/60 pl-3 py-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber/80">
                ⚠ stretched
              </p>
              <p className="font-sans text-sm text-white/85">{refine.warning}</p>
            </div>
          )}
          {refine.outcome === "reject" && (
            <div className="flex flex-col gap-2">
              <p className="font-sans text-sm text-amber">
                <strong>Not formalizable as a Lean 4 theorem.</strong>{" "}
                {refine.rejection_reason}
              </p>
              {refine.suggested_redirect && (
                <div className="border-l-2 border-cyan/40 pl-3 py-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-cyan/80 mb-1">
                    suggested redirect
                  </p>
                  <p className="font-sans text-xs text-white/80">
                    {refine.suggested_redirect}
                  </p>
                </div>
              )}
            </div>
          )}
          {refine.parse_error && (
            <div className="border border-amber/40 bg-amber/10 p-2 font-mono text-[10px] text-amber">
              ⚠ LLM YAML didn't parse: {refine.parse_error}. Edit the spec below
              and re-run the wizard.
            </div>
          )}
        </div>
      )}

      {/* Step 2 outcome */}
      {rating && (
        <div className="border border-line p-3 flex flex-col gap-2">
          {rating.fallback && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-amber/80">
              ⚠ heuristic rating · 0G Compute provider unreachable
            </div>
          )}
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
                <strong>Research-grade.</strong> Both novelty and difficulty
                rate ≥ 9 — a long-standing open problem requiring an insight
                that has resisted experts.
              </span>
            </div>
          )}
          <p className="font-sans text-sm text-white/80 italic">
            {rating.reasoning}
          </p>
        </div>
      )}

      {/* Step 3 outcome */}
      {dup && (
        <div className="border border-line p-3 flex flex-col gap-1.5">
          {dup.warning_level === "ok" ? (
            <p className="font-mono text-[11px] text-cyan">
              ✓ no near-duplicates found in the existing bounty roster
            </p>
          ) : (
            <>
              <p
                className={`font-mono text-[11px] uppercase tracking-widest ${dup.warning_level === "block" ? "text-amber" : "text-amber/80"}`}
              >
                {dup.warning_level === "block"
                  ? "⛔ exact duplicate — would not deploy"
                  : "⚠ near-duplicate detected"}
              </p>
              {dup.duplicates.map((d) => (
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

      {/* Unlock indicator */}
      {s3 === "passed" && (
        <div className="border border-cyan bg-cyan/15 px-3 py-2 font-mono text-[11px] text-cyan flex items-center gap-2">
          <span>🔓</span>
          <span>
            spec unlocked — review the YAML below, then mint demo USDC and post.
          </span>
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
