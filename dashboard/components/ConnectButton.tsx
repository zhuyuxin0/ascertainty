"use client";

import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";

/** Compact, palette-matched ConnectButton.
 *  Renders as a thin border + cyan text chip on the brand-dark background.
 */
export function ConnectButton() {
  return (
    <RKConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        if (!ready) {
          return <div className="h-7 w-28 border border-line bg-bg/50" aria-hidden />;
        }
        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="font-mono text-[10px] uppercase tracking-widest border border-cyan/60 text-cyan px-3 py-1 hover:bg-cyan hover:text-bg transition-colors"
            >
              connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="font-mono text-[10px] uppercase tracking-widest border border-amber bg-amber/10 text-amber px-3 py-1"
            >
              wrong network
            </button>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={openChainModal}
              className="font-mono text-[10px] uppercase tracking-widest border border-line text-white/60 px-2 py-1 hover:border-cyan/60 hover:text-cyan"
              title={chain.name ?? ""}
            >
              {(chain.name ?? "chain").split(" ")[0]}
            </button>
            <button
              onClick={openAccountModal}
              className="font-mono text-[10px] uppercase tracking-widest border border-cyan/60 text-cyan px-3 py-1 hover:bg-cyan hover:text-bg"
            >
              {account.displayName}
            </button>
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}
