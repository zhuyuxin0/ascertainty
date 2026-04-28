import Link from "next/link";

import { Header } from "@/components/Header";
import { SubmitProofForm } from "@/components/SubmitProofForm";
import { API_URL, type Bounty, type Submission } from "@/lib/api";

export const dynamic = "force-dynamic";

type StatusResp = {
  bounty: Bounty;
  submissions: Submission[];
};

async function loadBounty(id: number): Promise<StatusResp | null> {
  try {
    const res = await fetch(`${API_URL}/bounty/${id}/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as StatusResp;
  } catch {
    return null;
  }
}

const EXPLORER = "https://chainscan-galileo.0g.ai";
const STATUS_BG: Record<string, string> = {
  open: "bg-cyan/15 text-cyan border-cyan/40",
  submitted: "bg-amber/15 text-amber border-amber/40",
  challenged: "bg-amber/30 text-amber border-amber",
  settled: "bg-cyan/30 text-cyan border-cyan",
  cancelled: "bg-white/5 text-white/40 border-white/20",
};

export default async function BountyDetailPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const id = parseInt(params.bountyId, 10);
  if (Number.isNaN(id)) return <NotFound />;
  const data = await loadBounty(id);
  if (!data) return <NotFound />;

  const { bounty, submissions } = data;
  const usdc = (parseInt(bounty.amount_usdc, 10) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const deadline = new Date(bounty.deadline_unix * 1000);
  const statusClass = STATUS_BG[bounty.status] ?? STATUS_BG.open;

  return (
    <main className="min-h-screen bg-grid">
      <Header active="bounties" />

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-24">
        <Link
          href="/bounties"
          className="inline-block font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan mb-6"
        >
          ← all bounties
        </Link>

        {/* Bounty header */}
        <div className="border border-line p-6 mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              bounty #{bounty.id}
              {bounty.onchain_bounty_id !== null && (
                <span className="text-cyan/60"> · on-chain {bounty.onchain_bounty_id}</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {bounty.erdos_class === 1 && (
                <span
                  className="font-mono text-[10px] uppercase tracking-widest border border-amber bg-amber/15 text-amber px-3 py-1"
                  title="0G Compute rated novelty + difficulty both ≥ 9"
                >
                  ✨ Erdős-class
                </span>
              )}
              {(bounty.novelty != null || bounty.difficulty != null) && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
                  N {bounty.novelty ?? "?"} · D {bounty.difficulty ?? "?"}
                </span>
              )}
              <span
                className={`font-mono text-[10px] uppercase tracking-widest border px-3 py-1 ${statusClass}`}
              >
                {bounty.status}
              </span>
            </div>
          </div>

          <div>
            <div className="font-mono text-4xl text-cyan">{usdc} MockUSDC</div>
            <div className="font-mono text-xs text-white/40 mt-1">
              deadline {deadline.toISOString().slice(0, 19).replace("T", " ")}Z · challenge window{" "}
              {bounty.challenge_window_seconds}s
            </div>
          </div>

          {bounty.tee_explanation && (
            <div className="border-l-2 border-cyan/40 pl-4 py-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/70 mb-1">
                0G Compute · TEE-verified spec gloss
              </div>
              <p className="font-sans text-sm text-white/85 leading-relaxed">
                {bounty.tee_explanation}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <Field label="poster">
              <Mono>{bounty.poster}</Mono>
            </Field>
            <Field label="spec hash">
              <Mono>{short(bounty.spec_hash, 18, 12)}</Mono>
            </Field>
            {bounty.tx_hash && (
              <Field label="create tx">
                <ExplorerTx hash={bounty.tx_hash} />
              </Field>
            )}
            {bounty.onchain_bounty_id !== null && (
              <Field label="contract">
                <ExplorerAddr addr="0x11E351EA4Ec6F9163916c1941320a0F6d2b80C1c" />
              </Field>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href={`/mission/${bounty.id}`}
              className="border border-cyan text-cyan px-5 py-2 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
            >
              mission control →
            </Link>
          </div>
        </div>

        {/* Wallet-driven proof submission (only when bounty is open) */}
        <SubmitProofForm bountyId={bounty.id} bountyStatus={bounty.status} />

        {/* Submissions */}
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-4">
          submissions · {submissions.length}
        </h2>
        {submissions.length === 0 ? (
          <div className="border border-line p-6 font-mono text-xs uppercase tracking-widest text-white/40 text-center">
            no submissions yet — connect a wallet above to be the first
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {submissions.map((s) => (
              <SubmissionCard key={s.id} sub={s} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const accepted = sub.accepted === 1;
  const submittedAt = new Date(sub.submitted_at * 1000).toISOString().slice(0, 19).replace("T", " ");
  return (
    <div className="border border-line p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          submission #{sub.id} · {submittedAt}Z
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${
            accepted
              ? "border-cyan/50 bg-cyan/10 text-cyan"
              : "border-amber/50 bg-amber/10 text-amber"
          }`}
        >
          {accepted ? "accepted" : "rejected"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
        <Field label="solver">
          <Mono>{short(sub.solver_address, 8, 6)}</Mono>
        </Field>
        {sub.verifier_mode && (
          <Field label="verifier">
            <span
              className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                sub.verifier_mode === "real_lean4"
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-white/20 bg-white/5 text-white/50"
              }`}
            >
              {sub.verifier_mode}
            </span>
          </Field>
        )}
        <Field label="proof sha256">
          <Mono>{short(sub.proof_hash, 14, 8)}</Mono>
        </Field>
        <Field label="attestation hash">
          <Mono>{short(sub.attestation_hash, 14, 8)}</Mono>
        </Field>
        {sub.onchain_tx_hash && (
          <Field label="submitProof tx">
            <ExplorerTx hash={sub.onchain_tx_hash} />
          </Field>
        )}
        {sub.kernel_output_hash && (
          <Field label="kernel output">
            <Mono>{short(sub.kernel_output_hash, 14, 8)}</Mono>
          </Field>
        )}
        {sub.storage_root_hash && (
          <Field label="0G Storage root">
            <Mono>{short(sub.storage_root_hash, 14, 8)}</Mono>
          </Field>
        )}
      </div>

      {sub.tee_explanation && (
        <div className="mt-2 border-l-2 border-cyan/40 pl-4 py-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/70 mb-1">
            0G Compute · TEE-verified explanation
          </div>
          <p className="font-sans text-sm text-white/80 leading-relaxed">{sub.tee_explanation}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-baseline">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-white/85">{children}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs text-white/85">{children}</code>;
}

function ExplorerAddr({ addr }: { addr: string }) {
  return (
    <a
      href={`${EXPLORER}/address/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-white/85 hover:text-cyan underline-offset-2 hover:underline"
    >
      {short(addr, 10, 6)}
    </a>
  );
}

function ExplorerTx({ hash }: { hash: string }) {
  return (
    <a
      href={`${EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-white/85 hover:text-cyan underline-offset-2 hover:underline"
    >
      {short(hash, 12, 6)}
    </a>
  );
}

function short(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function NotFound() {
  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">
          bounty not found
        </p>
        <Link
          href="/bounties"
          className="font-mono text-xs text-cyan hover:underline"
        >
          ← back to all bounties
        </Link>
      </div>
    </main>
  );
}
