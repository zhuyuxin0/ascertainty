"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Address, formatUnits, maxUint256 } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { BountyAssistant } from "@/components/BountyAssistant";
import { Header } from "@/components/Header";
import { API_URL } from "@/lib/api";
import { BOUNTY_FACTORY_ABI, MOCK_USDC_ABI } from "@/lib/contracts";

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
bounty_usdc: 1000000000  # 1,000 MockUSDC
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
bounty_usdc: 5000000000  # 5,000 MockUSDC
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
bounty_usdc: 500000000  # 500 MockUSDC
deadline_unix: ${Math.floor(Date.now() / 1000) + 86400 * 7}
challenge_window_seconds: 30
tags:
  - mathlib
`,
};

const FAUCET_AMOUNT = 1_000_000_000n; // 1,000 MockUSDC (6 decimals)

type Prepared = {
  spec_hash: `0x${string}`;
  amount_usdc: string;
  deadline_unix: number;
  challenge_window_seconds: number;
  bounty_factory: Address;
  mock_usdc: Address;
};

export default function NewBountyPage() {
  const { address, isConnected } = useAccount();
  const [specYaml, setSpecYaml] = useState(SPEC_TEMPLATES.sort);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "approving" | "creating" | "notifying" | "done">("idle");
  const [created, setCreated] = useState<{
    bountyId: number;
    onchainId: number | null;
    txHash: string | null;
  } | null>(null);

  const amount = useMemo(() => (prepared ? BigInt(prepared.amount_usdc) : 0n), [prepared]);

  // Live MockUSDC reads
  const { data: balance } = useReadContract({
    abi: MOCK_USDC_ABI,
    address: prepared?.mock_usdc,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!prepared, refetchInterval: 5000 },
  });
  const { data: allowance } = useReadContract({
    abi: MOCK_USDC_ABI,
    address: prepared?.mock_usdc,
    functionName: "allowance",
    args: address && prepared ? [address, prepared.bounty_factory] : undefined,
    query: { enabled: !!address && !!prepared, refetchInterval: 5000 },
  });

  const needsFunds = prepared && balance !== undefined && (balance as bigint) < amount;
  const needsApproval = prepared && allowance !== undefined && (allowance as bigint) < amount;

  // wagmi write hooks
  const { writeContractAsync, data: writeTxHash, reset: resetWrite } = useWriteContract();
  const { isLoading: txMining } = useWaitForTransactionReceipt({ hash: writeTxHash });

  async function onPrepare() {
    setError(null);
    setPhase("preparing");
    try {
      const res = await fetch(`${API_URL}/bounty/prepare-create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec_yaml: specYaml }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as Prepared;
      if (!data.bounty_factory || !data.mock_usdc) {
        throw new Error("backend did not return contract addresses (publisher not configured?)");
      }
      setPrepared(data);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  async function onMintFaucet() {
    if (!prepared || !address) return;
    setError(null);
    try {
      const hash = await writeContractAsync({
        abi: MOCK_USDC_ABI,
        address: prepared.mock_usdc,
        functionName: "mint",
        args: [address, FAUCET_AMOUNT],
      });
      // ConnectButton handles the wallet UI; balance refetches every 5s
      console.log("faucet mint tx", hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onApprove() {
    if (!prepared) return;
    setError(null);
    setPhase("approving");
    try {
      await writeContractAsync({
        abi: MOCK_USDC_ABI,
        address: prepared.mock_usdc,
        functionName: "approve",
        args: [prepared.bounty_factory, maxUint256],
      });
      // wagmi auto-refetches reads after the next block; user clicks Create after
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  async function onCreate() {
    if (!prepared || !address) return;
    setError(null);
    // Pre-flight: every on-chain `require` check, surfaced as a clear
    // error before we burn gas on a sure-revert.
    const nowSec = Math.floor(Date.now() / 1000);
    if (prepared.deadline_unix <= nowSec) {
      setError(
        `deadline is in the past (${new Date(prepared.deadline_unix * 1000).toISOString()}) — fix the YAML and re-prepare.`,
      );
      return;
    }
    if (prepared.deadline_unix - nowSec < 60) {
      setError(
        `deadline is too tight (${prepared.deadline_unix - nowSec}s out) — push it at least 1 minute into the future.`,
      );
      return;
    }
    if (amount <= 0n) {
      setError("bounty amount must be > 0.");
      return;
    }
    setPhase("creating");
    try {
      const txHash = await writeContractAsync({
        abi: BOUNTY_FACTORY_ABI,
        address: prepared.bounty_factory,
        functionName: "createBounty",
        args: [
          prepared.spec_hash,
          amount,
          BigInt(prepared.deadline_unix),
          prepared.challenge_window_seconds,
        ],
      });
      setPhase("notifying");
      // Backend verifies the receipt + parses BountyCreated for the on-chain id
      const res = await fetch(`${API_URL}/bounty/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spec_yaml: specYaml,
          poster_address: address,
          tx_hash: txHash,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setCreated({
        bountyId: data.bounty_id,
        onchainId: data.onchain?.onchain_bounty_id ?? null,
        txHash: data.onchain?.tx_hash ?? txHash,
      });
      setPhase("done");
      resetWrite();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  return (
    <main className="min-h-screen bg-grid">
      <Header active="bounties" />

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          new bounty
        </p>
        <h1 className="text-4xl font-light mt-3 mb-3">
          escrow MockUSDC for a verifiable claim
        </h1>
        <p className="font-mono text-xs text-white/50 mb-12">
          You connect your wallet → mint demo USDC if needed → approve →
          createBounty. Your address is the on-chain poster; gas and escrow
          come from your wallet, not the operator.
        </p>

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
                href={`/bounty/${created.bountyId}`}
                className="border border-cyan text-cyan px-5 py-2 text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors"
              >
                view bounty →
              </Link>
              <Link
                href={`/mission/${created.bountyId}`}
                className="border border-line text-white/60 px-5 py-2 text-xs uppercase tracking-widest hover:border-white/40 hover:text-white"
              >
                mission control
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <BountyAssistant
              specYaml={specYaml}
              setSpecYaml={(y) => {
                setSpecYaml(y);
                setPrepared(null);
              }}
            />

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-white/60 mb-2">
                quick fill template
              </label>
              <div className="flex gap-2">
                {Object.keys(SPEC_TEMPLATES).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSpecYaml(SPEC_TEMPLATES[key]);
                      setPrepared(null);
                    }}
                    className="font-mono text-[10px] uppercase tracking-widest border border-line text-white/60 px-3 py-2 hover:border-cyan hover:text-cyan"
                  >
                    {key}
                  </button>
                ))}
              </div>
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
                onChange={(e) => {
                  setSpecYaml(e.target.value);
                  setPrepared(null);
                }}
                rows={20}
                className="w-full bg-bg border border-line text-white font-mono text-xs px-3 py-3 focus:border-cyan focus:outline-none whitespace-pre"
                spellCheck={false}
              />
            </div>

            {/* Wallet status block */}
            {!isConnected ? (
              <div className="border border-amber/40 bg-amber/10 p-4 font-mono text-xs text-amber">
                Connect a wallet (top-right) to post a bounty from your own address.
              </div>
            ) : (
              <div className="border border-line p-4 flex flex-col gap-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40 uppercase tracking-widest">poster</span>
                  <span className="text-white/85">{short(address!)}</span>
                </div>
                {prepared && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-white/40 uppercase tracking-widest">amount</span>
                      <span className="text-cyan">
                        {formatUnits(amount, 6)} MockUSDC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40 uppercase tracking-widest">balance</span>
                      <span className={needsFunds ? "text-amber" : "text-white/85"}>
                        {balance !== undefined ? formatUnits(balance as bigint, 6) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40 uppercase tracking-widest">allowance</span>
                      <span className={needsApproval ? "text-amber" : "text-white/85"}>
                        {allowance !== undefined
                          ? (allowance as bigint) >= maxUint256 / 2n
                            ? "max"
                            : formatUnits(allowance as bigint, 6)
                          : "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="border border-amber/40 bg-amber/10 p-4 font-mono text-xs text-amber whitespace-pre-wrap break-words">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {!prepared ? (
                <button
                  type="button"
                  onClick={onPrepare}
                  disabled={phase === "preparing"}
                  className="border border-cyan text-cyan px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
                >
                  {phase === "preparing" ? "parsing spec…" : "prepare"}
                </button>
              ) : (
                <>
                  {needsFunds && isConnected && (
                    <button
                      type="button"
                      onClick={onMintFaucet}
                      disabled={txMining}
                      className="border border-amber text-amber px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-amber hover:text-bg disabled:opacity-50"
                    >
                      {txMining ? "minting…" : "mint 1,000 demo USDC"}
                    </button>
                  )}
                  {!needsFunds && needsApproval && isConnected && (
                    <button
                      type="button"
                      onClick={onApprove}
                      disabled={phase === "approving" || txMining}
                      className="border border-amber text-amber px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-amber hover:text-bg disabled:opacity-50"
                    >
                      {phase === "approving" || txMining ? "approving…" : "approve MockUSDC"}
                    </button>
                  )}
                  {!needsFunds && !needsApproval && isConnected && (
                    <button
                      type="button"
                      onClick={onCreate}
                      disabled={phase === "creating" || phase === "notifying" || txMining}
                      className="border border-cyan text-cyan px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg disabled:opacity-50"
                    >
                      {phase === "creating"
                        ? "broadcasting createBounty…"
                        : phase === "notifying"
                          ? "indexing…"
                          : "create bounty"}
                    </button>
                  )}
                </>
              )}
              <Link
                href="/bounties"
                className="border border-line text-white/60 px-6 py-3 font-mono text-xs uppercase tracking-widest hover:border-white/40 hover:text-white"
              >
                cancel
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function short(s: string, head = 6, tail = 4): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
