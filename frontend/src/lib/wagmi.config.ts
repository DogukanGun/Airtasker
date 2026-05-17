"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Kite Testnet (Local)";
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://localhost:8545";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "http://localhost:4000";
const nativeSymbol = process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL ?? "ETH";

export const kiteTestnet = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: { name: nativeSymbol, symbol: nativeSymbol, decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: `${chainName} Explorer`, url: explorerUrl },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName:   "Airtasker Agents",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo-project-id",
  chains:    [kiteTestnet],
  ssr:       true,
});
