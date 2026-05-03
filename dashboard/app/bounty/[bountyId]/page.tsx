/* Claim proceedings page — formerly the bounty detail dashboard.
 *
 * Cream paper field. Composes the proceedings sub-components in
 * components/claim/* with the existing data wiring (loadBounty +
 * loadFactoryInfo) untouched. SubmitProofForm is preserved verbatim
 * — interactive surfaces stay as-is, just rewrapped in the
 * proceedings frame.
 *
 * Layout (top to bottom):
 *   I.   Masthead          — Cardinal + breadcrumb + live status
 *   II.  Claim Banner      — filing id, theorem h1, lede, status block,
 *                            headline USDC figure
 *   III. Filing Strip      — 6-cell metadata row
 *   IV.  Argument          — TheoremSigil + theorem + tee gloss + premises
 *   V.   Evidence          — submissions as evidence cards (left)
 *        Live ledger       — dusk insert (right, sticky)
 *   VI.  Settlement        — KeeperHub/operator authority card
 *   VII. Submit a proof    — SubmitProofForm preserved; ghost when not open
 *   VIII.Colophon          — minimal back link
 */

import Link from "next/link";

import { SubmitProofForm } from "@/components/SubmitProofForm";
import { ClaimMasthead } from "@/components/claim/ClaimMasthead";
import { ClaimBanner } from "@/components/claim/ClaimBanner";
import { ClaimFilingStrip } from "@/components/claim/ClaimFilingStrip";
import {
  ClaimArgument,
  ClaimEvidence,
  SectionHead,
} from "@/components/claim/ClaimSections";
import { ClaimAside } from "@/components/claim/ClaimAside";
import { ClaimSettlement } from "@/components/claim/ClaimSettlement";
import { API_URL, type Bounty, type Submission } from "@/lib/api";

export const dynamic = "force-dynamic";

type StatusResp = { bounty: Bounty; submissions: Submission[] };

type SettlementInfo = {
  driver: "keeperhub" | "operator";
  authority_address: string | null;
  function: string;
  permissionless: boolean;
  chain_id: number | null;
};

type FactoryInfo = { address: string | null; settlement: SettlementInfo | null };

async function loadBounty(id: number): Promise<StatusResp | null> {
  try {
    const res = await fetch(`${API_URL}/bounty/${id}/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StatusResp;
  } catch {
    return null;
  }
}

async function loadFactoryInfo(): Promise<FactoryInfo> {
  try {
    const res = await fetch(`${API_URL}/agent/status`, { cache: "no-store" });
    if (!res.ok) return { address: null, settlement: null };
    const data = await res.json();
    return {
      address: data?.chain?.contracts?.BountyFactory ?? null,
      settlement: data?.settlement ?? null,
    };
  } catch {
    return { address: null, settlement: null };
  }
}

export default async function ClaimProceedingsPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const id = parseInt(params.bountyId, 10);
  if (Number.isNaN(id)) return <NotFound />;
  const [data, factory] = await Promise.all([loadBounty(id), loadFactoryInfo()]);
  if (!data) return <NotFound />;

  const { bounty, submissions } = data;

  return (
    <main
      className="min-h-screen text-ink/94"
      style={{
        backgroundColor: "#FAF6E8",
        backgroundImage: `
          radial-gradient(circle at 18% 22%, rgba(10,21,37,0.045) 0.6px, transparent 1.1px),
          radial-gradient(circle at 72% 64%, rgba(10,21,37,0.035) 0.5px, transparent 1px),
          radial-gradient(circle at 38% 86%, rgba(10,21,37,0.04) 0.6px, transparent 1.1px),
          radial-gradient(circle at 60% 12%, rgba(184, 118, 20, 0.025) 1.2px, transparent 2.2px)
        `,
        backgroundSize: "14px 14px, 11px 11px, 19px 19px, 27px 27px",
        backgroundBlendMode: "multiply",
        fontFamily: "var(--font-inter-tight), ui-sans-serif, system-ui, sans-serif",
        fontWeight: 300,
      }}
    >
      <ClaimMasthead bountyId={bounty.id} onchainBountyId={bounty.onchain_bounty_id} />
      <ClaimBanner bounty={bounty} submissions={submissions} />
      <ClaimFilingStrip bounty={bounty} submissions={submissions} />
      <ClaimArgument bounty={bounty} />

      {/* Evidence + Live ledger — two-column on desktop, stacked on mobile */}
      <section className="border-b border-ink/12 py-16">
        <div className="mx-auto max-w-[1640px] px-6 md:px-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
            <div>
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
              {submissions.length === 0 ? (
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
              ) : (
                <div className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-px bg-ink/12 border border-ink/12">
                  {/* SubmissionCards rendered inside ClaimEvidence; we want the
                      live ledger sibling so we render its inner grid here. */}
                  {/* Implementation note: ClaimEvidence renders its own header
                      + grid, so reuse it here without the header by spreading
                      the cards directly. */}
                  <InlineEvidence submissions={submissions} />
                </div>
              )}
            </div>

            <div>
              <ClaimAside
                submissions={submissions}
                status={bounty.status}
                filedAt={bounty.created_at}
              />
            </div>
          </div>
        </div>
      </section>

      <ClaimSettlement
        settlement={factory.settlement}
        challengeWindowSeconds={bounty.challenge_window_seconds}
      />

      {/* Submit a proof — preserves the existing wagmi-driven form */}
      <section className="border-b border-ink/12 py-16">
        <div className="mx-auto max-w-[1640px] px-6 md:px-14">
          <SectionHead
            num="§ 04"
            title={<>File a <em>proof</em></>}
            right={
              <p className="font-sans text-[13px] text-ink/66 max-w-sm">
                connect a wallet, paste a Lean proof, sign the EIP-191 message.
                operator pays gas; the recovered address becomes the on-chain
                solver of record.
              </p>
            }
          />
          <div className="mt-10">
            {/* SubmitProofForm preserved verbatim — wrap in a cream card */}
            <div className="border border-ink/12 bg-cream-card p-6 md:p-8">
              <SubmitProofForm bountyId={bounty.id} bountyStatus={bounty.status} />
            </div>
          </div>
        </div>
      </section>

      {/* Colophon */}
      <footer className="border-t border-ink/12 bg-cream-soft/40">
        <div className="mx-auto max-w-[1640px] px-6 md:px-14 py-10 flex flex-wrap items-baseline justify-between gap-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66">
          <Link href="/bounties" className="hover:text-peacock transition-colors">
            ← back to bounties
          </Link>
          <Link href={`/mission/${bounty.id}`} className="hover:text-peacock transition-colors">
            mission control · live telemetry →
          </Link>
          <span>
            specimen filed{" "}
            <em className="not-italic font-display italic text-[13px] tracking-normal normal-case text-persimmon">
              {new Date(bounty.created_at * 1000)
                .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </em>
          </span>
        </div>
      </footer>
    </main>
  );
}

/* Inline evidence renderer — same body as ClaimEvidence's card grid but
 * without the section header (the parent section already owns the head
 * because we're side-by-side with the live ledger aside). */
function InlineEvidence({ submissions }: { submissions: Submission[] }) {
  return (
    <>
      {submissions.map((s, i) => (
        <EvidenceRow key={s.id} sub={s} index={i + 1} />
      ))}
    </>
  );
}

const EXPLORER = "https://chainscan-galileo.0g.ai";
const short = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

function EvidenceRow({ sub, index }: { sub: Submission; index: number }) {
  const accepted = sub.accepted === 1;
  const tone = accepted ? "peacock" : "rose";
  const tag = accepted ? "ACCEPTED · KERNEL" : "REJECTED · KERNEL";
  const submittedAt = new Date(sub.submitted_at * 1000).toISOString().slice(0, 19).replace("T", " ");

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

function NotFound() {
  return (
    <main className="min-h-screen bg-cream text-ink/94 flex items-center justify-center">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-persimmon">
          № AC-404 · not on file
        </p>
        <h1 className="font-display text-[48px] mt-3 text-ink/94">claim not found.</h1>
        <p className="mt-3 font-sans text-[14px] text-ink/66">
          the bounty id you requested does not exist in the registry.
        </p>
        <Link
          href="/bounties"
          className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-peacock hover:underline"
        >
          ← back to bounties
        </Link>
      </div>
    </main>
  );
}
