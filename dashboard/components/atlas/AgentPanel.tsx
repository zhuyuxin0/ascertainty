"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { API_URL } from "@/lib/api";

/**
 * Slide-in right-side agent status panel.
 *
 * Replaces the route jump to `/agent`. Shows the four 0G pillars +
 * KeeperHub state + persona iNFTs in a compact rail. The full /agent
 * route still exists for share-links and deeper inspection, but the
 * common HUD-level "what's going on with my agent right now" answer
 * lives here without leaving /atlas.
 */

type AgentStatus = {
  inft: {
    ready: boolean;
    minted: boolean;
    contract_address: string | null;
    token_id: number | null;
    owner: string | null;
    storage_root_hash: string | null;
    model_descriptor: string | null;
    version_tag: string | null;
  };
  chain: {
    network: string;
    chainId: number;
    contracts: Record<string, string>;
  } | null;
  operator: string | null;
  storage: { configured: boolean };
  keeperhub: {
    configured: boolean;
    recent_executions: Array<{
      id: number;
      ts: number;
      bounty_id: number | null;
      execution_id: string | null;
      status: string;
    }>;
  };
};

type Persona = {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  reputation: number;
  solved_count: number;
  token_id: number | null;
};

const EXPLORER = "https://chainscan-galileo.0g.ai";

export function AgentPanel({
  open,
  onClose,
  onSelectPersona,
}: {
  open: boolean;
  onClose: () => void;
  onSelectPersona?: (slug: string) => void;
}) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`${API_URL}/agent/status`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/agent/personas`).then((r) =>
        r.ok ? r.json() : { personas: [] },
      ),
    ])
      .then(([s, p]: [AgentStatus | null, { personas: Persona[] }]) => {
        setStatus(s);
        setPersonas(p.personas ?? []);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="agent-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="fixed top-0 right-0 h-full z-30 pointer-events-auto w-[min(440px,92vw)] border-l border-line bg-panel/95 backdrop-blur shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-line/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
              agent · live status
            </p>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-base text-white/40 hover:text-cyan leading-none"
              aria-label="close panel"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {error && (
              <div className="border border-amber/40 bg-amber/10 p-3 font-mono text-[11px] text-amber">
                backend unreachable: {error}
              </div>
            )}

            {/* Persona iNFTs */}
            {personas.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-2">
                  persona iNFTs · {personas.length}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {personas.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => onSelectPersona?.(p.slug)}
                      className="border bg-bg/40 p-2 text-left hover:bg-bg/60 transition-colors"
                      style={{ borderColor: p.color }}
                    >
                      <div
                        className="font-display text-base flex items-center gap-1.5 leading-none"
                        style={{ color: p.color }}
                      >
                        <span className="text-lg">{p.emoji}</span>
                        <span>{p.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-2 font-mono text-[9px]">
                        <div>
                          <div className="text-white/30 uppercase tracking-widest">
                            rep
                          </div>
                          <div
                            className="tabular-nums"
                            style={{ color: p.color }}
                          >
                            {p.reputation}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/30 uppercase tracking-widest">
                            solved
                          </div>
                          <div
                            className="tabular-nums"
                            style={{ color: p.color }}
                          >
                            {p.solved_count}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {status === null ? (
              <div className="border border-dashed border-line/60 p-4 font-mono text-[11px] text-white/40 text-center">
                no agent status
              </div>
            ) : (
              <>
                {/* 0G Chain pillar */}
                <Pillar title="0G Chain · Galileo" color="#00d4aa">
                  {status.chain ? (
                    <>
                      <KV k="network" v={status.chain.network} />
                      <KV k="chain id" v={String(status.chain.chainId)} />
                      {status.operator && (
                        <KV
                          k="operator"
                          v={
                            <a
                              href={`${EXPLORER}/address/${status.operator}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-hash text-white/85 hover:text-cyan"
                            >
                              {short(status.operator, 8, 6)} ↗
                            </a>
                          }
                        />
                      )}
                      {Object.entries(status.chain.contracts).map(([n, a]) => (
                        <KV
                          key={n}
                          k={n.toLowerCase()}
                          v={
                            <a
                              href={`${EXPLORER}/address/${a}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-hash text-white/85 hover:text-cyan"
                            >
                              {short(a, 8, 6)} ↗
                            </a>
                          }
                        />
                      ))}
                    </>
                  ) : (
                    <KV k="status" v="unconfigured" />
                  )}
                </Pillar>

                {/* iNFT */}
                <Pillar title="0G iNFT · ERC-7857" color="#7DD3F7">
                  <KV
                    k="status"
                    v={
                      <Pill
                        ok={status.inft.ready}
                        text={status.inft.ready ? "minted" : "pending"}
                      />
                    }
                  />
                  {status.inft.token_id !== null && (
                    <KV k="token id" v={`#${status.inft.token_id}`} />
                  )}
                  {status.inft.model_descriptor && (
                    <KV k="model" v={status.inft.model_descriptor} />
                  )}
                  {status.inft.storage_root_hash && (
                    <KV
                      k="storage root"
                      v={
                        <span className="font-hash text-white/60">
                          {short(status.inft.storage_root_hash, 10, 6)}
                        </span>
                      }
                    />
                  )}
                </Pillar>

                {/* 0G Storage */}
                <Pillar title="0G Storage" color="#C7A6FF">
                  <KV
                    k="status"
                    v={
                      <Pill
                        ok={status.storage.configured}
                        text={
                          status.storage.configured ? "configured" : "off"
                        }
                      />
                    }
                  />
                  <p className="font-mono text-[10px] text-white/40 leading-relaxed">
                    every accepted attestation uploads to 0G; the resulting
                    Merkle root anchors on-chain via{" "}
                    <code className="text-cyan/80">submitProof</code>.
                  </p>
                </Pillar>

                {/* KeeperHub */}
                <Pillar title="KeeperHub MCP" color="#ff6b35">
                  <KV
                    k="status"
                    v={
                      <Pill
                        ok={status.keeperhub.configured}
                        text={
                          status.keeperhub.configured ? "configured" : "off"
                        }
                      />
                    }
                  />
                  <KV
                    k="executions"
                    v={`${status.keeperhub.recent_executions.length} recent`}
                  />
                  {status.keeperhub.recent_executions.slice(0, 3).map((ex) => (
                    <div
                      key={ex.id}
                      className="font-mono text-[10px] flex items-baseline justify-between border-b border-line/40 py-1"
                    >
                      <span className="text-white/60">
                        bounty #{ex.bounty_id ?? "?"} · {ex.status}
                      </span>
                      <span className="text-white/40">
                        {ex.execution_id ? short(ex.execution_id, 6, 4) : "—"}
                      </span>
                    </div>
                  ))}
                </Pillar>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pillar({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line/70 bg-bg/30 p-3">
      <p
        className="font-mono text-[10px] uppercase tracking-[0.25em] mb-2"
        style={{ color }}
      >
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline font-mono text-[11px]">
      <span className="text-white/40 uppercase tracking-widest text-[9px]">
        {k}
      </span>
      <span className="text-white/85">{v}</span>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-block font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 ${
        ok
          ? "border-cyan/60 bg-cyan/10 text-cyan"
          : "border-white/20 bg-white/5 text-white/40"
      }`}
    >
      {text}
    </span>
  );
}

function short(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
