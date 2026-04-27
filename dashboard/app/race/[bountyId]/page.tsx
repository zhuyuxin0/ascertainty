import RaceCanvas from "@/components/RaceCanvas";
import Link from "next/link";

export default function RaceForBountyPage({
  params,
}: {
  params: { bountyId: string };
}) {
  const bountyId = parseInt(params.bountyId, 10);
  if (Number.isNaN(bountyId)) {
    return (
      <main className="h-screen grid place-items-center font-mono text-xs uppercase tracking-widest text-white/40">
        invalid bounty id
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden">
      <RaceCanvas
        className="absolute inset-0"
        mode="replay"
        bountyId={bountyId}
      />

      <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between pointer-events-none">
        <Link
          href="/bounties"
          className="font-mono text-xs uppercase tracking-widest text-white/60 hover:text-cyan pointer-events-auto"
        >
          ← bounties
        </Link>
        <div className="font-mono text-xs uppercase tracking-widest text-cyan/80">
          bounty #{bountyId} · live race
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-10 font-mono text-[10px] text-white/40 leading-tight pointer-events-none max-w-xs">
        <div>each car = one solver</div>
        <div>track shape derived from proof dependency graph</div>
        <div>events streamed from /bounty/{bountyId}/race-events</div>
      </div>
    </main>
  );
}
