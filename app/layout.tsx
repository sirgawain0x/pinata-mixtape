import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Outfit, Reenie_Beanie, Share_Tech_Mono } from "next/font/google";
import { cookieToInitialState } from "@account-kit/core";
import { base, baseSepolia } from "@account-kit/infra";
import { config } from "../config";
import { Providers } from "./providers";
import "@account-kit/react/styles.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-outfit",
  display: "swap"
});

const reenieBeanie = Reenie_Beanie({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-reenie-beanie",
  display: "swap"
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-share-tech-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Pinata Mixtape",
  description: "Retro mixtape manager agent template for Pinata-hosted agents."
};

const ALLOWED_CHAIN_IDS = new Set<number>([base.id, baseSepolia.id]);

/**
 * Drops the Account Kit cookie state if it was written by an earlier config
 * (different chain set, older storage version, etc.). Without this guard the
 * stale cookie's connections Map gets `setState`'d into the store, then
 * `getAlchemyTransport` throws ChainNotFoundError on first render.
 *
 * The cookie reviver only re-attaches full chain objects when zustand's
 * persist middleware rehydrates — `cookieToInitialState` (the SSR path)
 * bypasses that, so the chain stub it returns can't be trusted across config
 * changes.
 */
function safeInitialState(state: ReturnType<typeof cookieToInitialState>) {
  const alchemy = state?.alchemy;
  if (!alchemy) return state;
  const chainId = alchemy.chain?.id;
  const connections = alchemy.connections;
  if (typeof chainId !== "number" || !ALLOWED_CHAIN_IDS.has(chainId)) return undefined;
  if (!(connections instanceof Map) || !connections.has(chainId)) return undefined;
  return state;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Hydrate Account Kit state from the cookie so the user appears signed in on first paint.
  // https://www.alchemy.com/docs/wallets/react/ssr#persisting-the-account-state
  const cookie = (await headers()).get("cookie") ?? undefined;
  const initialState = safeInitialState(cookieToInitialState(config, cookie));

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${reenieBeanie.variable} ${shareTechMono.variable}`}
    >
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
