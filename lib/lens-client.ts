import { PublicClient } from "@lens-protocol/client";
import { mainnet } from "@lens-protocol/env";

export const lensClient = PublicClient.create({ environment: mainnet });
