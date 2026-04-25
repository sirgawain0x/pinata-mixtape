import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "@account-kit/core";
import { config } from "../config";
import { Providers } from "./providers";
import "@account-kit/react/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinata Mixtape",
  description: "Retro mixtape manager agent template for Pinata-hosted agents."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Hydrate Account Kit state from the cookie so the user appears signed in on first paint.
  // https://www.alchemy.com/docs/wallets/react/ssr#persisting-the-account-state
  const initialState = cookieToInitialState(config, (await headers()).get("cookie") ?? undefined);

  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
