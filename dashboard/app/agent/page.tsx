import Link from "next/link";

import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

type AgentStatus = {
  inft: {
    configured: boolean;
    ready: boolean;
    minted: boolean;
    contract_address: string | null;
    token_id: number | null;
    owner: string | null;
    storage_root_hash: string | null;
    model_descriptor: string | null;
    version_tag: string | null;
    minted_at: number | null;
    tx_hash: string | null;
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
      workflow_id: string;
      execution_id: string | null;
      status: string;
    }>;
  };
};

async function loadStatus(): Promise<AgentStatus | null> {
  try {
    const res = await fetch(`${API_URL}/agent/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AgentStatus;
  } catch {
    return null;
  }
}

const EXPLORER = "https://chainscan-galileo.0g.ai";

export default async function AgentStatusPage() {
  const status = await loadStatus();

  return (
    <main className="min-h-screen bg-grid">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan rounded-none" />
            <span className="font-mono text-sm tracking-widest uppercase">
              Ascertainty
            </span>
          </Link>
          <nav className="flex gap-6 font-mono text-xs uppercase tracking-widest text-white/60">
            <Link href="/bounties" className="hover:text-cyan">Bounties</Link>
            <Link href="/leaderboard" className="hover:text-cyan">Leaderboard</Link>
            <Link href="/agent" className="text-cyan">Agent</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          ascertainty agent · live status
        </p>
        <h1 className="text-4xl font-light mt-3 mb-12">
          all four 0G pillars + KeeperHub, live on Galileo
        </h1>

        {status === null ? (
          <div className="border border-amber/40 bg-amber/10 p-6 font-mono text-xs">
            backend unreachable
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* iNFT */}
            <Panel title="0G iNFT (ERC-7857)" pillar="0G iNFT">
              <Row label="status">
                <Pill ok={status.inft.ready} text={status.inft.ready ? "minted" : "pending"} />
              </Row>
              {status.inft.token_id !== null && (
                <Row label="token id">#{status.inft.token_id}</Row>
              )}
              {status.inft.owner && (
                <Row label="owner">
                  <Mono>{short(status.inft.owner)}</Mono>
                </Row>
              )}
              {status.inft.model_descriptor && (
                <Row label="model">{status.inft.model_descriptor}</Row>
              )}
              {status.inft.version_tag && <Row label="version">{status.inft.version_tag}</Row>}
              {status.inft.storage_root_hash && (
                <Row label="storage root">
                  <Mono>{short(status.inft.storage_root_hash, 14, 8)}</Mono>
                </Row>
              )}
              {status.inft.minted_at && (
                <Row label="minted at">
                  {new Date(status.inft.minted_at * 1000).toISOString().slice(0, 19) + "Z"}
                </Row>
              )}
              {status.inft.contract_address && (
                <Row label="contract">
                  <ExplorerLink addr={status.inft.contract_address} />
                </Row>
              )}
            </Panel>

            {/* 0G Chain */}
            <Panel title="0G Chain (Galileo)" pillar="0G Chain">
              {status.chain ? (
                <>
                  <Row label="network">{status.chain.network}</Row>
                  <Row label="chain id">{status.chain.chainId}</Row>
                  <Row label="operator">
                    {status.operator && <ExplorerLink addr={status.operator} />}
                  </Row>
                  {Object.entries(status.chain.contracts).map(([name, addr]) => (
                    <Row key={name} label={name.toLowerCase()}>
                      <ExplorerLink addr={addr} />
                    </Row>
                  ))}
                </>
              ) : (
                <Row label="status">unconfigured</Row>
              )}
            </Panel>

            {/* 0G Storage */}
            <Panel title="0G Storage" pillar="0G Storage">
              <Row label="status">
                <Pill ok={status.storage.configured} text={status.storage.configured ? "configured" : "off"} />
              </Row>
              <p className="font-mono text-[10px] text-white/40 leading-relaxed">
                Every accepted attestation is uploaded to 0G Storage; the resulting
                Merkle root is anchored on-chain via <Mono>BountyFactory.submitProof(attestationHash)</Mono>.
                The agent identity itself lives at the root above.
              </p>
            </Panel>

            {/* KeeperHub */}
            <Panel title="KeeperHub MCP" pillar="KeeperHub">
              <Row label="status">
                <Pill ok={status.keeperhub.configured} text={status.keeperhub.configured ? "configured" : "off"} />
              </Row>
              <Row label="executions">
                {status.keeperhub.recent_executions.length === 0 ? (
                  <span className="text-white/40">none yet</span>
                ) : (
                  <span>{status.keeperhub.recent_executions.length} recent</span>
                )}
              </Row>
              {status.keeperhub.recent_executions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {status.keeperhub.recent_executions.slice(0, 5).map((ex) => (
                    <div
                      key={ex.id}
                      className="font-mono text-[10px] flex items-center justify-between border-b border-line/40 py-1"
                    >
                      <span className="text-white/60">
                        bounty #{ex.bounty_id ?? "?"} · {ex.status}
                      </span>
                      <span className="text-white/40 truncate max-w-[140px]">
                        {ex.execution_id ? short(ex.execution_id, 8, 4) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="font-mono text-[10px] text-white/40 leading-relaxed mt-2">
                Each <Mono>/bounty/submit</Mono> accept fires the configured
                KeeperHub workflow via MCP <Mono>execute_workflow</Mono>.
              </p>
            </Panel>
          </div>
        )}
      </section>
    </main>
  );
}

function Panel({
  title,
  pillar,
  children,
}: {
  title: string;
  pillar: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-sm uppercase tracking-widest text-cyan">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          prize · {pillar}
        </span>
      </div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-baseline">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-white/85">{children}</span>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-block font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 ${
        ok ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-white/20 bg-white/5 text-white/40"
      }`}
    >
      {text}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs text-white/85">{children}</code>;
}

function ExplorerLink({ addr }: { addr: string }) {
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

function short(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}
