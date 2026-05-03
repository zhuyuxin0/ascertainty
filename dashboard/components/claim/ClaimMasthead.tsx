/* Claim masthead — sticky cream-paper header.
 *
 * Anatomy: Cardinal + wordmark (left) · breadcrumb back to Atlas / Bounties /
 * the present claim (center) · live status pill + on-chain explorer link
 * (right).
 *
 * Cardinal carries `view-transition-name: brand` for the cross-page morph
 * from the landing or atlas. */
import Image from "next/image";
import Link from "next/link";

const EXPLORER = "https://chainscan-galileo.0g.ai";

export function ClaimMasthead({
  bountyId,
  onchainBountyId,
}: {
  bountyId: number;
  onchainBountyId: number | null;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-ink/12 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(to bottom, rgba(250,246,232,0.96), rgba(250,246,232,0.82))",
      }}
    >
      <div className="mx-auto max-w-[1640px] px-6 md:px-14 py-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-sans font-medium text-[15px] tracking-[-0.01em] text-ink/94 no-underline"
            style={{ viewTransitionName: "brand" }}
          >
            <Image
              src="/logo/cardinal-daylight.svg"
              alt="Ascertainty"
              width={28}
              height={28}
              priority
            />
            <span>Ascertainty</span>
            <span className="ml-0.5 h-[5px] w-[5px] self-end rounded-full bg-persimmon" />
          </Link>

          <nav className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/66 hidden md:flex">
            <Link href="/atlas" className="hover:text-peacock transition-colors">
              atlas
            </Link>
            <span className="text-ink/46">›</span>
            <Link href="/bounties" className="hover:text-peacock transition-colors">
              bounties
            </Link>
            <span className="text-ink/46">›</span>
            <Link href="#" className="hover:text-peacock transition-colors">
              theorem
            </Link>
            <span className="text-ink/46">›</span>
            <span className="text-ink/94">the present claim</span>
          </nav>

          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66">
            <span className="flex items-center gap-1.5">
              <span className="h-[5px] w-[5px] rounded-full bg-peacock animate-pulse" />
              <span className="text-peacock">live</span>
            </span>
            <span className="text-ink/46">·</span>
            <span>bounty #{bountyId}</span>
            {onchainBountyId !== null && (
              <>
                <span className="text-ink/46">·</span>
                <span className="text-peacock">on-chain {onchainBountyId}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
