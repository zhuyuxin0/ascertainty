/* Settlement Authority section on cream paper.
 *
 * Replaces the dusk-grey card from the previous bounty page with the
 * proceedings-doc treatment. Same data: shows the live KH wallet
 * (or operator fallback) that will drive settleBounty() when the
 * challenge window expires. Anchored as § 04 of the proceedings (§ 03 is
 * the live course; see components/claim/CourseLive.tsx).
 *
 * Preserves the original card's information but on cream:
 *   driver (keeperhub | operator) → tone-coded pill
 *   authority address → linked to Galileo explorer
 *   function signature → mono code
 *   permissionless flag → peacock pill
 *   chain id from the active deployment
 */

import { SectionHead } from "./ClaimSections";

const EXPLORER = "https://chainscan-galileo.0g.ai";

type Settlement = {
  driver: "keeperhub" | "operator";
  authority_address: string | null;
  function: string;
  permissionless: boolean;
  chain_id: number | null;
};

export function ClaimSettlement({
  settlement,
  challengeWindowSeconds,
}: {
  settlement: Settlement | null;
  challengeWindowSeconds: number;
}) {
  if (!settlement) return null;

  const isKH = settlement.driver === "keeperhub";

  return (
    <section className="border-b border-ink/12 py-16">
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <SectionHead
          num="§ 04"
          title={<><em>Settlement</em> authority</>}
          right={
            <p className="font-sans text-[13px] text-ink/66 max-w-md">
              after the {challengeWindowSeconds}s challenge window expires
              with no contest, anyone can call{" "}
              <em className="text-persimmon not-italic font-display italic">
                settleBounty(bountyId)
              </em>
              {" "}— USDC always flows to the recorded solver, never to the
              caller.
            </p>
          }
        />

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-px bg-ink/12 border border-ink/12">
          <Cell k="driver">
            <span
              className={`inline-flex items-center font-mono text-[11px] uppercase tracking-[0.16em] border px-3 py-1 ${
                isKH
                  ? "border-peacock bg-peacock/10 text-peacock"
                  : "border-persimmon bg-persimmon/10 text-persimmon-deep"
              }`}
            >
              {settlement.driver}
            </span>
            <p className="mt-3 font-sans text-[12px] leading-snug text-ink/66">
              {isKH
                ? "KeeperHub's hosted Turnkey wallet on chain 16602 signs and broadcasts the settlement tx."
                : "Operator wallet signs the settlement tx as fallback. KH unreachable or unconfigured."}
            </p>
          </Cell>

          <Cell k="signer">
            {settlement.authority_address ? (
              <a
                href={`${EXPLORER}/address/${settlement.authority_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-hash text-[14px] text-ink/94 hover:text-peacock transition-colors break-all"
              >
                {settlement.authority_address}
              </a>
            ) : (
              <span className="font-hash text-[12px] text-ink/66">—</span>
            )}
            <p className="mt-3 font-sans text-[12px] leading-snug text-ink/66">
              the wallet that will pay gas + sign the on-chain tx. clickable
              to the Galileo block explorer for independent audit.
            </p>
          </Cell>

          <Cell k="function">
            <span className="font-hash text-[14px] text-peacock">
              {settlement.function}
            </span>
            <div className="mt-2 flex items-center gap-2">
              {settlement.permissionless && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] border border-peacock/40 bg-peacock/10 text-peacock px-2 py-0.5">
                  permissionless
                </span>
              )}
              {settlement.chain_id != null && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
                  chain {settlement.chain_id}
                </span>
              )}
            </div>
            <p className="mt-3 font-sans text-[12px] leading-snug text-ink/66">
              the contract function. KH downtime can't strand the payout —
              the function is public and any third-party keeper could drive
              it equally.
            </p>
          </Cell>
        </div>
      </div>
    </section>
  );
}

function Cell({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="bg-cream-card p-6 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/66 mb-1">
        {k}
      </span>
      {children}
    </div>
  );
}
