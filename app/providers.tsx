"use client";

import type { AlchemyClientState } from "@account-kit/core";
import { AlchemyAccountProvider } from "@account-kit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren } from "react";
import { config, queryClient } from "../config";

export function Providers({
  initialState,
  children
}: PropsWithChildren<{ initialState?: AlchemyClientState }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={config} queryClient={queryClient} initialState={initialState}>
        {children}
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
}
