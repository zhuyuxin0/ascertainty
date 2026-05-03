"use client";
/* AgentPanel — settlement authority + 0G pillars + persona iNFTs.
 *
 * Reads /agent/status (Settlement Authority KH wallet, contracts,
 * operator) and /agent/personas (the three persona iNFTs) on open.
 * Cream-paper treatment matching the proceedings doc, not the dusk
 * dashboard panel of v2. */

import { useEffect, useState } from "react";

import { useAtlasV3 } from "@/lib/atlas-v3/state";
import { API_URL } from "@/lib/api";

import { PanelShell, KV, Section, usePanelOpen } from "./PanelShell";

const EXPLORER = "https://chainscan-galileo.0g.ai";
const short = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

type Status = {
  inft: { ready: boolean; token_id: number | null; storage_root_hash: string | null };
  chain: { network: string; chainId: number; contracts: Record<string, string> } | null;
  operator: string | null;
  storage: { configured: boolean };
  keeperhub: { configured: boolean; wallet_address: string | null; recent_executions: Array<{ id: number; bounty_id: number | null; status: string }> };
  settlement: { driver: "keeperhub" | "operator"; authority_address: string | null; function: string; permissionless: boolean; chain_id: number | null };
};

type Persona = { slug: string; name: string; emoji: string; address: string | null; reputation: number; solved_count: number };

export function AgentPanel() {
  const open = usePanelOpen("agent");
  const closePanel = useAtlasV3((s) => s.closePanel);
  const openPersona = useAtlasV3((s) => s.openPersona);
  const [status, setStatus] = useState<Status | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/agent/status`).then((r) => r.json()).then(setStatus).catch(() => {});
    fetch(`${API_URL}/agent/personas`).then((r) => r.json()).then((d) => setPersonas(d.personas ?? [])).catch(() => {});
  }, [open]);

  return (
    <PanelShell open={open} onClose={closePanel} eyebrow="¶ vol. iv · agent status" width={440}>
      <h2 className="font-display italic text-[28px] leading-tight text-ink/94 mb-5">
        your settlement <em className="text-persimmon">authority</em>.
      </h2>

      {personas.length > 0 && (
        <div className="mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-2">
            persona iNFTs · seeds
          </div>
          <div className="grid grid-cols-3 gap-2">
            {personas.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => {
                  openPersona(p.slug);
                  closePanel();
                }}
                className="border border-ink/12 bg-cream p-2.5 text-left hover:border-peacock transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-display text-[12px] leading-none">
                  <span className="text-base">{p.emoji}</span>
                  <span className="text-ink/94">{p.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 font-mono text-[9px]">
                  <div>
                    <div className="text-ink/46 uppercase tracking-widest">rep</div>
                    <div className="text-ink/94 tabular-nums">{p.reputation}</div>
                  </div>
                  <div>
                    <div className="text-ink/46 uppercase tracking-widest">solved</div>
                    <div className="text-ink/94 tabular-nums">{p.solved_count}</div>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[9px] uppercase tracking-widest text-ink/46">
                  inspect →
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/46 mb-2">four pillars</div>
      <div className="flex flex-col gap-3">
        {status?.chain && (
          <Section num="0G" title="0G Chain">
            <KV k="network" v={status.chain.network} />
            <KV k="chain" v={String(status.chain.chainId)} />
            {status.operator && (
              <KV
                k="operator"
                v={
                  <a href={`${EXPLORER}/address/${status.operator}`} target="_blank" rel="noopener noreferrer" className="font-hash hover:text-peacock">
                    {short(status.operator)} ↗
                  </a>
                }
              />
            )}
            {status.chain.contracts.BountyFactory && (
              <KV
                k="bounty"
                v={
                  <a href={`${EXPLORER}/address/${status.chain.contracts.BountyFactory}`} target="_blank" rel="noopener noreferrer" className="font-hash hover:text-peacock">
                    {short(status.chain.contracts.BountyFactory)} ↗
                  </a>
                }
              />
            )}
          </Section>
        )}
        {status?.inft && (
          <Section num="iNFT" title="0G iNFT · ERC-7857">
            <KV k="token" v={status.inft.token_id !== null ? `#${status.inft.token_id}` : "pending"} />
            <KV k="storage" v={status.inft.storage_root_hash ? "on-chain metadata" : "—"} />
            {status.inft.storage_root_hash && (
              <KV k="root" v={<span className="font-hash text-peacock">{short(status.inft.storage_root_hash)}</span>} />
            )}
          </Section>
        )}
        {status?.storage && (
          <Section num="storage" title="0G Storage">
            <KV k="provider" v={`0G ${status.chain?.network ?? "Galileo"} · TEE`} />
            <KV k="merkle" v="anchored via submitProof" />
          </Section>
        )}
        {status?.settlement && (
          <Section num="keeperhub" title="Settlement Authority">
            <KV
              k="driver"
              v={
                <span className={status.settlement.driver === "keeperhub" ? "text-peacock" : "text-persimmon"}>
                  {status.settlement.driver}
                </span>
              }
            />
            {status.settlement.authority_address && (
              <KV
                k="signer"
                v={
                  <a
                    href={`${EXPLORER}/address/${status.settlement.authority_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-hash hover:text-peacock"
                  >
                    {short(status.settlement.authority_address)} ↗
                  </a>
                }
              />
            )}
            <KV k="function" v={<span className="font-hash text-peacock">{status.settlement.function}</span>} />
            <KV k="last run" v={status.keeperhub.recent_executions[0]?.status ?? "idle"} />
          </Section>
        )}
        {!status && (
          <div className="border border-dashed border-ink/22 p-5 font-mono text-[10px] uppercase tracking-widest text-ink/46 text-center">
            backend unreachable · retrying
          </div>
        )}
      </div>
    </PanelShell>
  );
}
