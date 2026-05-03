"use client";
/* WalletChip — cream-paper-tuned RainbowKit wallet for the v3 atlas
 * top-right HUD. Replaces the hardcoded "0x8f2…4c1e" placeholder.
 *
 * Three render branches:
 *   not-mounted → ghost skeleton
 *   not-connected → "connect wallet" persimmon-bordered button
 *   connected → chain badge + truncated address chip with peacock dot
 *
 * Wrong-network state surfaces an amber warning chip that opens the
 * RK chain switcher. */

import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";

import { useAtlasV3 } from "@/lib/atlas-v3/state";

export function WalletChip() {
  const showTooltip = useAtlasV3((s) => s.showTooltip);
  const moveTooltip = useAtlasV3((s) => s.moveTooltip);
  const hideTooltip = useAtlasV3((s) => s.hideTooltip);

  const tip = (label: string, body: string) => ({
    onMouseEnter: (e: React.MouseEvent) => showTooltip({ label, body, keys: [["click", "opens RainbowKit"]] }, e),
    onMouseMove: (e: React.MouseEvent) => moveTooltip(e),
    onMouseLeave: () => hideTooltip(),
  });

  return (
    <RKConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        if (!mounted) {
          return <div className="h-7 w-32 border border-ink/12 bg-cream-card/50" aria-hidden />;
        }
        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="font-mono text-[10px] uppercase tracking-[0.14em] border border-persimmon bg-persimmon/[0.06] text-persimmon-deep px-3 py-1.5 hover:bg-persimmon hover:text-cream-card transition-colors cursor-pointer"
              {...tip("connect wallet", "Connect a wallet to mint, stake, and submit proofs.")}
            >
              connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] border border-rose bg-rose/[0.08] text-rose px-3 py-1.5 cursor-pointer"
              {...tip("wrong network", "Click to switch to 0G Galileo.")}
            >
              <span>⚠</span>
              <span>wrong network</span>
            </button>
          );
        }
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="flex items-center gap-1.5 border border-ink/22 px-2.5 py-1 cursor-pointer hover:border-peacock transition-colors font-mono text-[10px] uppercase tracking-[0.14em]"
            {...tip("wallet", `${account.displayName} on ${chain.name ?? "chain"} · click for menu.`)}
          >
            <span className="text-peacock text-[12px]" aria-hidden>●</span>
            <span className="text-ink/94">{(chain.name ?? "chain").split(" ")[0]}</span>
            <span className="font-hash text-ink/66 normal-case tracking-normal">{account.displayName}</span>
          </button>
        );
      }}
    </RKConnectButton.Custom>
  );
}
