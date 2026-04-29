import { type AlchemyAccountsUIConfig, cookieStorage, createConfig } from "@account-kit/react";
import { alchemy, base, baseSepolia } from "@account-kit/infra";
import { QueryClient } from "@tanstack/react-query";

const API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "missing-alchemy-api-key";

// Optional — populate to enable gas sponsorship for any UserOps the app sends.
const POLICY_ID = process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID;

// 8453 = Base mainnet (default), 84532 = Base Sepolia (dev/test)
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
if (![base.id, baseSepolia.id].includes(CHAIN_ID)) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID must be 8453 or 84532.");
}
const chain = CHAIN_ID === baseSepolia.id ? baseSepolia : base;

// Optional — only required if WalletConnect / external EOA login is used.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

const uiConfig: AlchemyAccountsUIConfig = {
  illustrationStyle: "outline",
  auth: {
    sections: [
      [{ type: "email" }],
      [
        { type: "passkey" },
        { type: "social", authProviderId: "google", mode: "popup" },
        ...(WC_PROJECT_ID
          ? ([
              {
                type: "external_wallets",
                walletConnect: { projectId: WC_PROJECT_ID }
              }
            ] as const)
          : [])
      ]
    ],
    addPasskeyOnSignup: false
  }
};

export const config = createConfig(
  {
    transport: alchemy({ apiKey: API_KEY }),
    chain,
    ssr: true,
    storage: cookieStorage,
    enablePopupOauth: true,
    ...(POLICY_ID ? { policyId: POLICY_ID } : {})
  },
  uiConfig
);

export const queryClient = new QueryClient();
