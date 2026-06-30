"use client";

import { AlchemyAccountProvider } from "@account-kit/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { alchemyMigrationConfig, queryClient } from "../config";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "missing-privy-app-id";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          appearance: {
            theme: "dark",
            accentColor: "#676FFF",
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
        }}
      >
        <AlchemyAccountProvider config={alchemyMigrationConfig} queryClient={queryClient}>
          {children}
        </AlchemyAccountProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}
