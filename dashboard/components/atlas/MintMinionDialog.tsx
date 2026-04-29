"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { decodeEventLog } from "viem";

import { MinionCard } from "@/components/atlas/MinionCard";
import { MINION_NFT_ABI, MINION_NFT_ADDRESS } from "@/lib/contracts";
import { ROLE_LABELS } from "@/lib/atlas/minionGenerator";

/**
 * Modal that mints a new MinionNFT on 0G Galileo. Steps:
 *   1) Pick role (Spotter / Solver / Spectator) and domain (free text or
 *      one of the suggested domains tied to the cosmos regions).
 *   2) Click mint → wagmi useWriteContract → user confirms in MetaMask.
 *   3) Wait for receipt; decode the MinionMinted event for the seed.
 *   4) Reveal the freshly-composed pixel-art card.
 */

const DOMAIN_SUGGESTIONS = [
  "number-theory",
  "ai-models",
  "polymarket",
  "erc-20",
  "pde-physics",
  "scientific-claims",
] as const;

type MintedMinion = {
  tokenId: number;
  role: number;
  domain: string;
  seed: string;
};

type Phase = "idle" | "minting" | "confirming" | "revealing";

export function MintMinionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [role, setRole] = useState(0);
  const [domain, setDomain] = useState<string>(DOMAIN_SUGGESTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [minted, setMinted] = useState<MintedMinion | null>(null);

  const { writeContractAsync, data: txHash, reset: resetWrite } = useWriteContract();
  const { isLoading: txMining, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // When the receipt lands, decode the MinionMinted event to fetch
  // tokenId + seed (the seed is what drives the card art).
  useEffect(() => {
    if (!receipt || !publicClient) return;
    try {
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({
            abi: MINION_NFT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (ev.eventName === "MinionMinted") {
            const args = ev.args as {
              tokenId: bigint;
              owner: string;
              role: number;
              domain: string;
              seed: bigint;
            };
            setMinted({
              tokenId: Number(args.tokenId),
              role: Number(args.role),
              domain: args.domain,
              seed: args.seed.toString(),
            });
            setPhase("revealing");
            return;
          }
        } catch {
          // not our event; keep walking
        }
      }
      setError("mint succeeded but MinionMinted event missing — try refresh");
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }, [receipt, publicClient]);

  function reset() {
    setMinted(null);
    setPhase("idle");
    setError(null);
    resetWrite();
  }

  async function onMint() {
    if (!address) return;
    setError(null);
    setPhase("minting");
    try {
      await writeContractAsync({
        abi: MINION_NFT_ABI,
        address: MINION_NFT_ADDRESS,
        functionName: "mint",
        args: [role, domain],
      });
      setPhase("confirming");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 grid place-items-center bg-bg/85 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            className="border border-cyan/40 bg-panel p-6 w-[480px] max-w-full flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
                  mint a minion
                </p>
                <p className="font-display text-2xl text-white mt-1">
                  add to your library
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-xs text-white/40 hover:text-cyan"
              >
                ✕
              </button>
            </div>

            {!isConnected && (
              <div className="border border-amber/40 bg-amber/10 p-3 font-mono text-[11px] text-amber">
                connect a wallet (top-right) to mint
              </div>
            )}

            {phase !== "revealing" && (
              <>
                {/* Role picker */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/50 mb-2">
                    role
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_LABELS.map((label, idx) => {
                      const active = role === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRole(idx)}
                          className={`border px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                            active
                              ? "border-cyan text-cyan bg-cyan/10"
                              : "border-line text-white/60 hover:border-cyan/60 hover:text-cyan"
                          }`}
                        >
                          {label.toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Domain */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/50 mb-2">
                    domain
                  </p>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    maxLength={48}
                    placeholder="number-theory"
                    className="w-full bg-bg border border-line text-white font-mono text-xs px-3 py-2 focus:border-cyan focus:outline-none mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {DOMAIN_SUGGESTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDomain(d)}
                        className="font-mono text-[9px] uppercase tracking-widest border border-line text-white/40 px-2 py-1 hover:border-cyan/60 hover:text-cyan"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="border border-amber/40 bg-amber/10 p-2 font-mono text-[10px] text-amber whitespace-pre-wrap break-words">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onMint}
                  disabled={!isConnected || !domain.trim() || phase !== "idle" || txMining}
                  className="border border-cyan text-cyan px-5 py-3 font-mono text-xs uppercase tracking-widest hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
                >
                  {phase === "minting" && "sign in your wallet…"}
                  {phase === "confirming" && "confirming on 0G Galileo…"}
                  {phase === "idle" && "✨ mint"}
                </button>
              </>
            )}

            {phase === "revealing" && minted && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-3"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">
                  minted ✓
                </p>
                <MinionCard
                  tokenId={minted.tokenId}
                  role={minted.role}
                  domain={minted.domain}
                  seed={minted.seed}
                  mintedAt={Math.floor(Date.now() / 1000)}
                  size="md"
                />
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-cyan border border-line px-3 py-1.5 hover:border-cyan"
                  >
                    mint another
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-mono text-[10px] uppercase tracking-widest text-cyan border border-cyan px-3 py-1.5 hover:bg-cyan hover:text-bg"
                  >
                    done
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
