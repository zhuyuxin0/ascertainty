"use client";
/* Landing chrome — sticky header on the cream paper field.
 *
 * Anatomy: Cardinal mark + wordmark (left) · live status breadcrumb
 * (center) · nav (right). The Cardinal carries
 * `view-transition-name: brand` so the cross-page morph to /atlas
 * (and /bounty/[id]) lands cleanly when supported. */
import Image from "next/image";
import Link from "next/link";

export function LandingChrome() {
  return (
    <header className="fixed inset-x-0 top-0 z-[100] py-4 backdrop-blur-md"
      style={{
        background: "linear-gradient(to bottom, rgba(250,246,232,0.94), rgba(250,246,232,0.74) 70%, rgba(250,246,232,0))",
      }}
    >
      <div className="mx-auto max-w-[1640px] px-6 md:px-14">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-sans font-medium text-[15px] tracking-[-0.01em] text-ink/94 no-underline"
            style={{ viewTransitionName: "brand" }}
          >
            <Image
              src="/logo/cardinal-daylight.svg"
              alt="Ascertainty"
              width={26}
              height={26}
              priority
            />
            <span>Ascertainty</span>
            <span className="ml-0.5 h-[5px] w-[5px] self-end rounded-full bg-persimmon" />
          </Link>

          {/* Live deployment breadcrumb — replaces the editorial "vol. iv"
              framing with product-true info. */}
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/66 hidden md:flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-[5px] w-[5px] rounded-full bg-peacock animate-pulse" />
              <span className="text-peacock">live</span>
            </span>
            <span className="text-ink/46">·</span>
            <span>0G galileo</span>
            <span className="text-ink/46">·</span>
            <span>chain 16602</span>
          </div>

          <nav className="flex items-center justify-end gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/66">
            <a href="#what" className="hover:text-peacock transition-colors">about</a>
            <a href="#provers" className="hover:text-peacock transition-colors">provers</a>
            <a href="#book" className="hover:text-peacock transition-colors">book</a>
            <a href="#ledger" className="hover:text-peacock transition-colors">ledger</a>
            <Link href="/atlas" className="text-ink/94 hover:text-peacock transition-colors">
              atlas ↗
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
