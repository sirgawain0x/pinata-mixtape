import { PublicClient } from "@lens-protocol/client";
import { mainnet } from "@lens-protocol/env";

/** Read-only Lens GraphQL client (mainnet). Env canary points at https://api.lens.xyz/graphql. */
export const lensClient = PublicClient.create({ environment: mainnet });
