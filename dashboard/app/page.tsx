/* Landing page — vol. iv, the verification quarterly.
 *
 * Cream paper field. Replaces the previous redirect-to-/atlas. /atlas is
 * still the cosmos entry point and is one click away (header nav, hero
 * primary CTA, atlas-portal teaser at hero foot, /atlas link in closer).
 *
 * Sections (top to bottom): chrome · hero · statement · numbers · protocol
 * · provers · ledger · book · closer · colophon.
 *
 * Data wiring: open-bounty count, weekly settled total, ledger drawers,
 * book of plates all come from /bounties + /stats. Receipt strip
 * addresses come from /agent/status (current BountyFactory + MockUSDC
 * on chain 16602). Persona stats come from /agent/personas.
 *
 * If the backend is unreachable, the page still renders — every section
 * has a fallback path so the design always shows. */
import { API_URL, type Bounty } from "@/lib/api";
import { LandingChrome } from "@/components/landing/LandingChrome";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingStatement, LandingNumbers } from "@/components/landing/LandingStatementNumbers";
import { LandingProtocol } from "@/components/landing/LandingProtocol";
import { LandingProvers } from "@/components/landing/LandingProvers";
import { LandingLedger, LandingBook } from "@/components/landing/LandingLedgerBook";
import { LandingCloser, LandingColophon } from "@/components/landing/LandingCloser";

export const dynamic = "force-dynamic";

type AgentStatus = {
  chain: { network: string; chainId: number; contracts: Record<string, string> } | null;
};

type PersonaResp = {
  personas: Array<{
    slug: string;
    name: string;
    address: string | null;
    reputation: number;
    solved_count: number;
    stats?: { accepted_count?: number; recent_paid_usdc?: number };
  }>;
};

async function safeGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadData() {
  const [bountiesResp, status, personas] = await Promise.all([
    safeGet<{ bounties: Bounty[] }>("/bounties?limit=50"),
    safeGet<AgentStatus>("/agent/status"),
    safeGet<PersonaResp>("/agent/personas"),
  ]);
  return {
    bounties: bountiesResp?.bounties ?? [],
    chain: status?.chain ?? null,
    personas: personas?.personas ?? [],
  };
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export default async function LandingPage() {
  const { bounties, chain, personas } = await loadData();

  const openCount = bounties.filter((b) => b.status === "open").length || null;

  // Weekly paid: sum amount_usdc of bounties settled in the last 7 days.
  // amount_usdc is in MockUSDC base units (6 decimals); convert to dollars.
  const now = Math.floor(Date.now() / 1000);
  const weeklyPaidUsd =
    bounties
      .filter((b) => b.status === "settled" && now - b.created_at <= SEVEN_DAYS)
      .reduce((sum, b) => sum + parseInt(b.amount_usdc, 10) / 1_000_000, 0) ||
    null;

  // Persona stats — map our backend personas (aggressive-andy / careful-carl
  // / balanced-bea) into the landing's nimue/orpheus/pythia slot order.
  // The design copy is aspirational/literary, not literal — the slugs
  // here are presentation aliases.
  const slugMap: Record<string, string> = {
    "aggressive-andy": "nimue",
    "careful-carl": "orpheus",
    "balanced-bea": "pythia",
  };
  const liveStats = personas.map((p) => ({
    slug: slugMap[p.slug] ?? p.slug,
    sealed: p.solved_count,
    paidUsd: p.stats?.recent_paid_usdc ?? 0,
    weeklyGain: p.stats?.accepted_count ?? 0,
    address: p.address,
  }));

  const contracts = chain?.contracts ?? {};

  return (
    <main
      className="min-h-screen text-ink/94"
      style={{
        // Cream paper + grain applied inline so we don't have to mutate
        // <body> from a server component. Mirrors body.paper in globals.css.
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
      <LandingChrome />
      <LandingHero openCount={openCount} weeklyPaidUsd={weeklyPaidUsd} />
      <LandingStatement />
      <LandingNumbers
        openCount={openCount}
        weeklyPaidUsd={weeklyPaidUsd}
        proverCount={personas.length || null}
      />
      <LandingProtocol />
      <LandingProvers liveStats={liveStats} />
      <LandingLedger bounties={bounties} />
      <LandingBook bounties={bounties} />
      <LandingCloser
        bountyFactory={contracts.BountyFactory ?? null}
        mockUsdc={contracts.MockUSDC ?? null}
        network={chain?.network ?? "0G galileo"}
      />
      <LandingColophon />
    </main>
  );
}
