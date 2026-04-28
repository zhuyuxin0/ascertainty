"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import { API_URL } from "@/lib/api";

const SAMPLE_PROOF = `theorem t : True := trivial
`;

type Prepared = {
  accepted: boolean;
  reason?: string;
  attestation_hash?: `0x${string}`;
  message_hash?: `0x${string}`;
  onchain_bounty_id?: number;
};

type SubmitResp = {
  bounty_id: number;
  spec_hash: string;
  accepted: boolean;
  attestation_hash: string;
  proof_hash: string;
  storage?: { root_hash: string; tx_hash: string; uploaded_at: number } | null;
  explanation?: string | null;
  onchain?: {
    tx_hash: string;
    block_number: number;
    via: "submitProofFor" | "submitProof";
  } | null;
  keeperhub?: { execution_id: string | null; status: string } | null;
};

export function SubmitProofForm({
  bountyId,
  bountyStatus,
}: {
  bountyId: number;
  bountyStatus: string;
}) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState(SAMPLE_PROOF);
  const [phase, setPhase] = useState<"idle" | "verifying" | "signing" | "relaying" | "done">("idle");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [result, setResult] = useState<SubmitResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (bountyStatus !== "open") {
    return null;
  }

  async function onSubmit() {
    if (!address) return;
    setError(null);
    setPhase("verifying");
    try {
      // 1) ask backend to verify + build attestation + return message_hash
      const prepRes = await fetch(`${API_URL}/bounty/submit-prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bounty_id: bountyId, solver_address: address, proof }),
      });
      if (!prepRes.ok) throw new Error(`prepare HTTP ${prepRes.status}: ${await prepRes.text()}`);
      const prep = (await prepRes.json()) as Prepared;
      setPrepared(prep);
      if (!prep.accepted) {
        setPhase("idle");
        setError(`verifier rejected the proof: ${prep.reason ?? "unknown"}`);
        return;
      }

      // 2) solver signs the message_hash off-chain
      setPhase("signing");
      const messageBytes = hexToBytes(prep.message_hash!);
      const signature = await signMessageAsync({ message: { raw: messageBytes } });

      // 3) operator relays via submitProofFor
      setPhase("relaying");
      const subRes = await fetch(`${API_URL}/bounty/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bounty_id: bountyId,
          solver_address: address,
          proof,
          signature,
          attestation_hash: prep.attestation_hash,
        }),
      });
      if (!subRes.ok) throw new Error(`submit HTTP ${subRes.status}: ${await subRes.text()}`);
      const data = (await subRes.json()) as SubmitResp;
      setResult(data);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  return (
    <div className="border border-line p-6 mb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          submit proof — gasless via submitProofFor
        </h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-cyan"
        >
          {open ? "hide" : "open"}
        </button>
      </div>

      {open && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="font-mono text-xs text-white/50 leading-relaxed">
            Connect your wallet, paste a Lean proof, sign the EIP-191
            attestation hash. Operator relays via{" "}
            <span className="text-cyan">submitProofFor</span> and pays the gas;
            your address is recovered on-chain via ECDSA, so only{" "}
            <span className="text-cyan">you</span> can claim. The default
            sample (<code className="text-white/80">theorem t : True := trivial</code>) is the universal-pass demo proof.
          </p>

          {!isConnected ? (
            <div className="border border-amber/40 bg-amber/10 p-3 font-mono text-xs text-amber">
              connect a wallet to submit
            </div>
          ) : (
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              solver: <span className="text-white/85 normal-case">{address}</span>
            </div>
          )}

          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            rows={6}
            className="bg-bg border border-line text-white font-mono text-xs px-3 py-3 focus:border-cyan focus:outline-none whitespace-pre"
            spellCheck={false}
          />

          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={onSubmit}
              disabled={!isConnected || phase !== "idle"}
              className="border border-cyan text-cyan px-5 py-2 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
            >
              {phase === "idle" && "submit"}
              {phase === "verifying" && "running Lean kernel…"}
              {phase === "signing" && "sign in your wallet…"}
              {phase === "relaying" && "operator relaying…"}
              {phase === "done" && "submitted ✓"}
            </button>
            {prepared?.accepted === false && prepared.reason && (
              <span className="font-mono text-[10px] text-amber">
                ↑ {prepared.reason}
              </span>
            )}
          </div>

          {error && (
            <div className="border border-amber/40 bg-amber/10 p-3 font-mono text-xs text-amber whitespace-pre-wrap break-words">
              {error}
            </div>
          )}

          {result && (
            <div className="border border-cyan/40 bg-cyan/5 p-4 font-mono text-xs flex flex-col gap-1">
              <div className="text-cyan uppercase tracking-widest">
                accepted · {result.onchain?.via ?? "no on-chain"}
              </div>
              {result.onchain && (
                <div className="text-white/70">
                  relay tx{" "}
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${result.onchain.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/85 hover:text-cyan underline-offset-2 hover:underline"
                  >
                    {result.onchain.tx_hash.slice(0, 12)}…
                  </a>
                </div>
              )}
              {result.storage?.root_hash && (
                <div className="text-white/70">
                  0G Storage root {result.storage.root_hash.slice(0, 14)}…
                </div>
              )}
              {result.explanation && (
                <div className="border-l-2 border-cyan/40 pl-3 mt-2 text-white/80 font-sans">
                  {result.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function hexToBytes(hex: `0x${string}` | string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
