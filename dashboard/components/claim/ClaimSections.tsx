/* The body of the claim proceedings doc — § 01 The argument, § 02 Evidence
 * on file, plus the live-ledger aside.
 *
 * Argument repurposes claim.html's "argument + premises" frame for our
 * domain: the TheoremSigil + theorem text + tee_explanation, followed by
 * a parsed list of `axiom_whitelist` items if present in the spec yaml.
 *
 * Evidence on file maps each accepted submission to an evidence card —
 * solver, verifier mode (real_lean4 / mock_lean4), kernel duration, proof
 * sha + attestation hash + 0G storage root. Rejected submissions render
 * as contrary-evidence cards with a rose tint. */

import Image from "next/image";

import type { Bounty, Submission } from "@/lib/api";

const EXPLORER = "https://chainscan-galileo.0g.ai";

const short = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

/** Filing ID for the sidebar mark — matches ClaimBanner's makeFilingId
 *  but rendered without the leading "№ AC-" since the Cardinal mark above
 *  already establishes the publisher. Just the date-tail uniqueness. */
function makeFilingIdShort(b: { created_at: number; onchain_bounty_id: number | null; id: number }): string {
  const d = new Date(b.created_at * 1000);
  const yyyymmdd =
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  const tail = b.onchain_bounty_id != null
    ? String(b.onchain_bounty_id).padStart(4, "0")
    : `OFF${String(b.id).padStart(3, "0")}`;
  return `№ ${yyyymmdd} · ${tail}`;
}

/** Spec-hash byte fingerprint — three 4-char chunks for a recognizable
 *  per-bounty visual signature without a generative seal. */
function hashBytes(specHash: string): string {
  const h = specHash.replace(/^0x/, "");
  return `${h.slice(0, 4)} · ${h.slice(4, 8)} · ${h.slice(8, 12)}`;
}

/** Lightweight regex extractors for the spec_yaml fields we care about.
 *  Avoids pulling in js-yaml just for four lookups; the spec is a simple
 *  flat-key YAML by convention so single-line regex is sufficient. */
function parseSpec(spec_yaml?: string): {
  theorem_signature: string;
  lean_toolchain: string;
  mathlib_sha: string;
  axiom_whitelist: string[];
} {
  if (!spec_yaml) {
    return { theorem_signature: "", lean_toolchain: "", mathlib_sha: "", axiom_whitelist: [] };
  }
  const pick = (key: string): string => {
    const m = spec_yaml.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)`, "m"));
    return m?.[1]?.trim() ?? "";
  };
  const axMatch = spec_yaml.match(/^axiom_whitelist:\s*\[([^\]]*)\]/m);
  const axioms = axMatch
    ? axMatch[1].split(",").map((a) => a.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    : [];
  return {
    theorem_signature: pick("theorem_signature"),
    lean_toolchain: pick("lean_toolchain"),
    mathlib_sha: pick("mathlib_sha"),
    axiom_whitelist: axioms,
  };
}

export function ClaimArgument({ bounty }: { bounty: Bounty }) {
  const { theorem_signature: theorem, lean_toolchain, mathlib_sha: mathlib, axiom_whitelist: axioms } = parseSpec(bounty.spec_yaml);
  const lean = lean_toolchain || "lean v4.10.0";

  return (
    <section className="border-b border-ink/12 py-16 md:py-20">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <SectionHead num="§ 01" title={<>The <em>argument</em></>} />

        <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-8 mt-10">
          {/* Brand mark + filing identification.
              Replaces the per-bounty generative TheoremSigil with the
              uniform Cardinal mark — every bounty is an "Ascertainty
              publication," so they share the publisher's mark. The
              filing ID + hash bytes do the per-bounty identification job
              the sigil was trying to do, and read as crafted typography
              rather than generated noise. */}
          <div className="hidden lg:flex flex-col items-start gap-4">
            <Image
              src="/logo/cardinal-daylight.svg"
              alt="Ascertainty"
              width={120}
              height={120}
              priority
            />
            <div className="flex flex-col gap-1.5 border-l-2 border-persimmon/40 pl-3">
              <span className="font-mono text-[11px] tracking-[0.18em] text-ink/94 select-all">
                {makeFilingIdShort(bounty)}
              </span>
              <span className="font-hash text-[10px] text-peacock select-all">
                {hashBytes(bounty.spec_hash)}
              </span>
            </div>
          </div>

          <div className="max-w-3xl">
            {theorem && (
              <p className="font-display text-[24px] md:text-[28px] leading-[1.35] tracking-[-0.005em] text-ink/94">
                <span className="font-display text-[64px] float-left mr-3 leading-[0.85] -mt-1 text-persimmon">
                  {theorem.charAt(0).toUpperCase()}
                </span>
                {theorem.slice(1) || theorem}
              </p>
            )}

            {bounty.tee_explanation && (
              <div className="mt-8 border-l-2 border-peacock/40 pl-5 py-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-peacock mb-1.5">
                  ¶ 0G Compute · TEE-verified gloss
                </div>
                <p className="font-sans text-[15px] leading-[1.7] text-ink/66">
                  {bounty.tee_explanation}
                </p>
              </div>
            )}

            {/* Premises — kernel constraints from the spec */}
            <div className="mt-10 flex flex-col gap-3">
              <Premise n="P1">
                <span className="text-ink/94">Verifier:</span> Lean kernel{" "}
                <em className="text-persimmon not-italic font-display italic">
                  {lean}
                </em>
                {" "}· deterministic, no human in the loop.
              </Premise>
              {mathlib && (
                <Premise n="P2">
                  <span className="text-ink/94">Mathlib SHA:</span>{" "}
                  <span className="font-hash text-[12px] text-peacock">
                    {short(mathlib, 8, 8)}
                  </span>
                  {" "}— the proof must check against this exact pinned commit.
                </Premise>
              )}
              {axioms.length > 0 && (
                <Premise n={mathlib ? "P3" : "P2"}>
                  <span className="text-ink/94">Axiom whitelist:</span>{" "}
                  {axioms.map((a, i) => (
                    <span key={a} className="font-hash text-[12px] text-ink/94">
                      {a}
                      {i < axioms.length - 1 && (
                        <span className="text-ink/46 mx-1">·</span>
                      )}
                    </span>
                  ))}
                  {" "}— proofs invoking other axioms are rejected at the kernel level.
                </Premise>
              )}
              <Premise n={`P${[mathlib, axioms.length > 0].filter(Boolean).length + 2}`}>
                <span className="text-ink/94">Settlement:</span> after the{" "}
                {bounty.challenge_window_seconds}s challenge window expires
                with no challenge,{" "}
                <em className="text-persimmon not-italic font-display italic">
                  settleBounty(bountyId)
                </em>
                {" "}is callable permissionlessly. USDC always flows to the
                recorded solver, never to the caller.
              </Premise>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClaimEvidence({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <section className="border-b border-ink/12 py-16">
        <div className="mx-auto max-w-[1640px] px-6 md:px-14">
          <SectionHead num="§ 02" title={<><em>Evidence</em> on file</>} />
          <div className="mt-10 border border-dashed border-ink/22 p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/66">
              awaiting first submission
            </p>
            <p className="mt-3 font-sans text-[14px] text-ink/66 max-w-md mx-auto">
              connect a wallet below to be the first prover on this claim.
              the kernel is impartial · early submission, late submission,
              same threshold.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-ink/12 py-16">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <SectionHead
          num="§ 02"
          title={<><em>Evidence</em> on file</>}
          right={
            <p className="font-sans text-[13px] text-ink/66 max-w-sm">
              each row is a kernel-checked submission. accepted attestations
              anchor on 0G Storage; the merkle root surfaces on-chain at
              submission time.
            </p>
          }
        />

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-px bg-ink/12 border border-ink/12">
          {submissions.map((s, i) => (
            <EvidenceCard key={s.id} sub={s} index={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EvidenceCard({ sub, index }: { sub: Submission; index: number }) {
  const accepted = sub.accepted === 1;
  const tone = accepted ? "peacock" : "rose";
  const tag = accepted ? "ACCEPTED · KERNEL" : "REJECTED · KERNEL";
  const submittedAt = new Date(sub.submitted_at * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  return (
    <div className="bg-cream-card p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className={tone === "peacock" ? "text-peacock" : "text-rose"}>
          E{String(index).padStart(2, "0")} · {tag}
        </span>
        {sub.verifier_mode && (
          <span
            className={`border px-2 py-0.5 ${
              sub.verifier_mode === "real_lean4"
                ? "border-peacock/50 bg-peacock/10 text-peacock"
                : "border-ink/22 bg-ink/10 text-ink/66"
            }`}
          >
            {sub.verifier_mode}
          </span>
        )}
      </div>

      <div className="font-display text-[18px] leading-snug text-ink/94">
        Submission by{" "}
        <a
          href={`${EXPLORER}/address/${sub.solver_address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-hash text-[14px] hover:text-peacock transition-colors"
        >
          {short(sub.solver_address, 8, 6)}
        </a>
        {" — "}
        <em className="text-ink/66">{accepted ? "kernel returned 0" : "kernel returned non-zero"}</em>
      </div>

      {sub.tee_explanation && (
        <div className="border-l-2 border-peacock/40 pl-4 py-1">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-peacock mb-1">
            ¶ 0G TEE explanation
          </div>
          <p className="font-sans text-[13px] leading-[1.6] text-ink/66">
            {sub.tee_explanation}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 border-t border-ink/12 pt-4">
        <Field label="proof sha">
          <span className="font-hash text-[11px] text-ink/94 normal-case tracking-normal">
            {short(sub.proof_hash, 10, 6)}
          </span>
        </Field>
        <Field label="attestation">
          <span className="font-hash text-[11px] text-ink/94 normal-case tracking-normal">
            {short(sub.attestation_hash, 10, 6)}
          </span>
        </Field>
        {sub.storage_root_hash && (
          <Field label="0G storage root">
            <span className="font-hash text-[11px] text-peacock normal-case tracking-normal">
              {short(sub.storage_root_hash, 10, 6)}
            </span>
          </Field>
        )}
        {sub.onchain_tx_hash && (
          <Field label="on-chain tx">
            <a
              href={`${EXPLORER}/tx/${sub.onchain_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-hash text-[11px] text-peacock hover:underline normal-case tracking-normal"
            >
              {short(sub.onchain_tx_hash, 10, 6)}
            </a>
          </Field>
        )}
        <Field label="submitted">
          <span className="font-hash text-[11px] text-ink/94 normal-case tracking-normal">
            {submittedAt}Z
          </span>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Premise({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[44px_1fr] gap-4 items-baseline border-l border-ink/12 pl-4 py-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-persimmon">
        {n}
      </span>
      <p className="font-sans text-[14px] leading-[1.6] text-ink/66">{children}</p>
    </div>
  );
}

export function SectionHead({
  num,
  title,
  right,
}: {
  num: string;
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 border-b border-ink/12 pb-5">
      <div className="flex items-baseline gap-5">
        <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-persimmon">
          {num}
        </span>
        <h2 className="font-display text-[28px] md:text-[36px] leading-none text-ink/94">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}
