/**
 * lib/wagmiConfig.ts
 * wagmi v2 + RainbowKit configuration
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia, polygon, polygonAmoy } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName:     "RWA20 Launchpad",
  projectId:   process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "rwa20-dev",
  chains:      [hardhat, sepolia, polygonAmoy, polygon],
  ssr:         true,
});
