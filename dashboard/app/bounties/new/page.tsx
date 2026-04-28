"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/components/Header";
import { API_URL } from "@/lib/api";

const SPEC_TEMPLATES: Record<string, string> = {
  sort: `bounty_id: sort-correctness-001
description: |
  Prove that mergeSort returns a permutation of its input that is
  monotonically non-decreasing under the provided ordering.
theorem_signature: "∀ {α : Type} [LinearOrder α] (xs : List α), Sorted (mergeSort xs) ∧ (mergeSort xs).Perm xs"
mathlib_sha: 5b1c4e7
lean_toolchain: "leanprover/lean4:v4.10.0"
axiom_whitelist:
  - propext
  - Classical.choice
  - Quot.sound
bounty_usdc: 1000000000  # 1,000 USDC
deadline_unix: ${Math.floor(Date.now() / 1000) + 86400 * 30}
challenge_window_seconds: 30
tags:
  - algorithms
  - lists
`,
  erc20: `bounty_id: erc20-transfer-invariant-001
description: |
  Prove that transfer(to, amount) preserves the sum of balances and
  shifts exactly amount from sender to recipient.
theorem_signature: "∀ s from to amount, from ≠ to → ∃ s', ERC20.transfer s from to amount = .ok s'"
mathlib_sha: 5b1c4e7
lean_toolchain: "leanprover/lean4:v4.10.0"
axiom_whitelist:
  - propext
  - Classical.choice
  - Quot.sound
bounty_usdc: 5000000000  # 5,000 USDC
deadline_unix: ${Math.floor(Date.now() / 1000) + 86400 * 60}
challenge_window_seconds: 60
tags:
  - solidity
  - erc20
  - invariants
`,
  mathlib: `bounty_id: mathlib-gap-finite-prod-cardinality-001
description: |
  Close a Mathlib gap: cardinality of indexed product of finite types
  equals the product of cardinalities.
theorem_signature: "∀ {ι} [Fintype ι] (α : ι → Type*) [∀ i, Fintype (α i)], Fintype.card ((i : ι) → α i) = ∏ i, Fintype.card (α i)"
mathlib_sha: 5b1c4e7
lean_toolchain: "leanprover/lean4:v4.10.0"
axiom_whitelist:
  - propext
  - Classical.choice
  - Quot.sound
bounty_usdc: 500000000  # 500 USDC
deadline_unix: ${Math.floor(Date.now() / 1000) + 86400 * 7}
challenge_window_seconds: 30
tags:
  - mathlib
`,
};

export default function NewBountyPage() {
  const router = useRouter();
  const [poster, setPoster] = useState("0xd932Aad9adA0B879f4654CD88071895085Fad0d0");
  const [specYaml, setSpecYaml] = useState(SPEC_TEMPLATES.sort);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    bountyId: number;
    onchainId: number | null;
    txHash: string | null;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/bounty/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: specYaml, poster_address: poster }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      const data = await res.json();
      setCreated({
        bountyId: data.bounty_id,
        onchainId: data.onchain?.onchain_bounty_id ?? null,
        txHash: data.onchain?.tx_hash ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-grid">
      <Header active="bounties" />

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          new bounty
        </p>
        <h1 className="text-4xl font-light mt-3 mb-12">
          escrow MockUSDC for a verifiable claim
        </h1>

        {created ? (
          <div className="border border-cyan/40 bg-cyan/5 p-6 font-mono text-sm">
            <p className="text-cyan uppercase tracking-widest text-xs mb-3">
              bounty created
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6 text-white/80">
              <span>off-chain id</span>
              <span>{created.bountyId}</span>
              <span>on-chain id</span>
              <span>{created.onchainId ?? "—"}</span>
              <span>create tx</span>
              <span className="truncate">{created.txHash ?? "—"}</span>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/race/${created.bountyId}`}
                className="border border-cyan text-cyan px-5 py-2 text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
              >
                watch race →
              </Link>
              <Link
                href="/bounties"
                className="border border-line text-white/60 px-5 py-2 text-xs uppercase tracking-widest hover:border-white/40 hover:text-white"
              >
                all bounties
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2">
                quick fill template
              </label>
              <div className="flex gap-2">
                {Object.keys(SPEC_TEMPLATES).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSpecYaml(SPEC_TEMPLATES[key])}
                    className="font-mono text-[10px] uppercase tracking-widest border border-line text-white/60 px-3 py-2 hover:border-cyan hover:text-cyan"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="poster"
                className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2"
              >
                poster address (escrows the USDC)
              </label>
              <input
                id="poster"
                value={poster}
                onChange={(e) => setPoster(e.target.value)}
                className="w-full bg-bg border border-line text-white font-mono text-sm px-3 py-2 focus:border-cyan focus:outline-none"
                placeholder="0x..."
              />
              <p className="font-mono text-[10px] text-white/40 mt-1">
                For the demo this defaults to the operator wallet (which has 1M MockUSDC).
              </p>
            </div>

            <div>
              <label
                htmlFor="spec"
                className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2"
              >
                bounty spec (YAML)
              </label>
              <textarea
                id="spec"
                value={specYaml}
                onChange={(e) => setSpecYaml(e.target.value)}
                rows={22}
                className="w-full bg-bg border border-line text-white font-mono text-xs px-3 py-3 focus:border-cyan focus:outline-none whitespace-pre"
                spellCheck={false}
              />
            </div>

            {error && (
              <div className="border border-amber/40 bg-amber/10 p-4 font-mono text-xs text-amber whitespace-pre-wrap break-words">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="border border-cyan text-cyan px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "creating + on-chain…" : "create bounty"}
              </button>
              <Link
                href="/bounties"
                className="border border-line text-white/60 px-6 py-3 font-mono text-xs uppercase tracking-widest hover:border-white/40 hover:text-white"
              >
                cancel
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
