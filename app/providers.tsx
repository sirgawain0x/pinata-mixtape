"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { queryClient } from "../config";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "missing-privy-app-id";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          accentColor: "#676FFF",
          theme: "#000000",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: ["email", "wallet", "farcaster", "google"],
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  );
}
