"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

/** 0G Galileo testnet — chainId 16602.
 *  RPC: https://evmrpc-testnet.0g.ai
 *  Explorer: https://chainscan-galileo.0g.ai
 *  Native token symbol: OG (used for gas, no decimals quirk).
 */
export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

// Use a placeholder projectId for dev — RainbowKit requires one for WalletConnect.
// Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in prod for production-grade WC support.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "ascertainty-demo-no-walletconnect";

export const wagmiConfig = getDefaultConfig({
  appName: "Ascertainty",
  projectId,
  chains: [galileo],
  ssr: true,
});
