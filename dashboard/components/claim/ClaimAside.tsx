/* Claim live ledger — the dusk-insert sidebar.
 *
 * Reverse-chronological feed of events for this specific bounty:
 *   submitProof       (peacock)  — solver submitted, kernel ran
 *   challenged        (rose)     — proof contested
 *   settled           (peacock)  — bounty paid out via settleBounty
 *   keeperhub run     (persimmon)— KH workflow execution (audit)
 *
 * Pulls submissions + KH executions from the bounty status payload
 * (already loaded server-side — no extra fetch). */

import type { Submission } from "@/lib/api";

const EXPLORER = "https://chainscan-galileo.0g.ai";

const short = (s: string, head = 6, tail = 4) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

function timeAgo(unix: number): string {
  const sec = Math.floor(Date.now() / 1000) - unix;
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

type Event = {
  ts: number;
  kind: "submit-accept" | "submit-reject" | "challenged" | "settled" | "kh";
  who?: string;
  text: React.ReactNode;
  txHash?: string | null;
};

function buildEvents(
  submissions: Submission[],
  status: string,
  filedAt: number,
): Event[] {
  const events: Event[] = [];
  for (const s of submissions) {
    events.push({
      ts: s.submitted_at,
      kind: s.accepted === 1 ? "submit-accept" : "submit-reject",
      who: s.solver_address,
      txHash: s.onchain_tx_hash,
      text: s.accepted === 1 ? (
        <>
          submitted a proof · kernel returned 0 ·{" "}
          <em className="text-bone/96">attestation anchored on 0G Storage</em>
        </>
      ) : (
        <>submitted a proof · kernel returned non-zero · rejected</>
      ),
    });
  }
  if (status === "challenged") {
    events.push({
      ts: filedAt + 1,
      kind: "challenged",
      text: <>contest opened · proof under review by the resolver</>,
    });
  }
  if (status === "settled") {
    events.push({
      ts: Math.floor(Date.now() / 1000) - 60,
      kind: "settled",
      text: <>settled on-chain via <em className="text-bone/96">settleBounty()</em> · USDC transferred</>,
    });
  }
  return events.sort((a, b) => b.ts - a.ts);
}

const DOT_TONE: Record<Event["kind"], string> = {
  "submit-accept": "bg-peacock-bright",
  "submit-reject": "bg-rose-bright",
  challenged: "bg-rose-bright",
  settled: "bg-peacock-bright",
  kh: "bg-persimmon-bright",
};

const VERB: Record<Event["kind"], { word: string; tone: string }> = {
  "submit-accept": { word: "Proof accepted", tone: "text-peacock-bright" },
  "submit-reject": { word: "Proof rejected", tone: "text-rose-bright" },
  challenged: { word: "Contest opened", tone: "text-rose-bright" },
  settled: { word: "Settled", tone: "text-peacock-bright" },
  kh: { word: "Keeper run", tone: "text-persimmon-bright" },
};

export function ClaimAside({
  submissions,
  status,
  filedAt,
}: {
  submissions: Submission[];
  status: string;
  filedAt: number;
}) {
  const events = buildEvents(submissions, status, filedAt);

  return (
    <aside className="bg-dusk text-bone p-6 md:p-8 flex flex-col gap-5 sticky top-24">
      <div className="flex items-baseline justify-between border-b border-bone/10 pb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone flex items-center gap-2">
          <span className="h-[6px] w-[6px] rounded-full bg-peacock-bright animate-pulse" />
          Live ledger
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone/66">
          since filing · {timeAgo(filedAt).replace(" ago", "")}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="font-mono text-[11px] text-bone/66 py-8 text-center">
          ledger empty · awaiting first proof
        </div>
      ) : (
        <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-2">
          {events.map((e, i) => {
            const verb = VERB[e.kind];
            return (
              <div key={i} className="grid grid-cols-[10px_1fr] gap-3">
                <span className={`mt-2 h-[8px] w-[8px] ${DOT_TONE[e.kind]}`} />
                <div className="flex flex-col gap-1">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${verb.tone}`}>
                    {verb.word}
                  </span>
                  <p className="font-sans text-[13px] leading-snug text-bone/96">
                    {e.who && (
                      <a
                        href={`${EXPLORER}/address/${e.who}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-hash text-[12px] text-peacock-bright hover:underline mr-1"
                      >
                        {short(e.who, 6, 4)}
                      </a>
                    )}
                    {e.text}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone/66">
                    {timeAgo(e.ts)}
                    {e.txHash && (
                      <>
                        {" · "}
                        <a
                          href={`${EXPLORER}/tx/${e.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-hash text-[10px] text-peacock-bright hover:underline normal-case tracking-normal"
                        >
                          {short(e.txHash, 6, 4)}
                        </a>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
