"use client";

import { base, mainnet, lens } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { queryClient } from "../config";
import { MIXTAPE_PRIVY_LOGIN_METHODS } from "../lib/privy-client-config";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "missing-privy-app-id";

  // Use the default web configuration. A stale app client ID blocks Privy startup.
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined,
        supportedChains: [base, mainnet, lens],
        appearance: {
          accentColor: "#e9347a",
          theme: "light",
          logo: "/app/mixtape/mark.png",
          landingHeader: "Welcome to Mixtape",
          loginMessage: "Your music. Your people. Your next discovery.",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: [...MIXTAPE_PRIVY_LOGIN_METHODS],
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  );
}
