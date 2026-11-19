import { File as BufferFile } from "node:buffer";
import { StorageClient, immutable, walletOnly } from "@lens-chain/storage-client";
import { getAddress, isAddress } from "viem";

export const LENS_GROVE_CHAIN_ID = 8453;

const FileImpl = globalThis.File ?? BufferFile;
let cachedClient: StorageClient | null = null;

function getClient(): StorageClient {
  if (!cachedClient) {
    cachedClient = StorageClient.create();
  }
  return cachedClient;
}

export type GroveUpload = {
  uri: string;
  storageKey: string;
  cid: string;
  url: string;
  size: number;
};

export function isGroveConfigured(): boolean {
  return process.env.LENS_GROVE_DISABLED?.trim().toLowerCase() !== "true";
}

export function resolveGroveUrl(uriOrCid: string): string {
  const trimmed = uriOrCid.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("lens://")) {
    try {
      return getClient().resolve(trimmed);
    } catch {
      return `https://api.grove.storage/${encodeURIComponent(trimmed.slice("lens://".length))}`;
    }
  }
  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length).replace(/^\/+/, "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return `https://api.grove.storage/${encodeURIComponent(trimmed)}`;
}

export async function uploadGroveFile(
  buffer: Buffer | Uint8Array,
  options: { name: string; mimeType?: string; chainId?: number },
): Promise<GroveUpload> {
  if (!isGroveConfigured()) {
    throw new Error("Lens Grove uploads are disabled (LENS_GROVE_DISABLED=true).");
  }

  const safeName = options.name.replace(/[^A-Za-z0-9._-]/g, "_") || "upload";
  const chainId = options.chainId ?? LENS_GROVE_CHAIN_ID;
  const bytes = Uint8Array.from(buffer);
  const file = new FileImpl(
    [bytes],
    safeName,
    options.mimeType ? { type: options.mimeType } : undefined,
  );

  const response = await getClient().uploadFile(file as unknown as File, {
    acl: immutable(chainId),
  });

  const uri = response.uri || `lens://${response.storageKey}`;
  const url = response.gatewayUrl || resolveGroveUrl(uri);

  return {
    uri,
    storageKey: response.storageKey,
    cid: uri,
    url,
    size: bytes.byteLength,
  };
}

export async function uploadGroveJson(
  payload: unknown,
  options?: { name?: string; walletAddress?: string; chainId?: number },
): Promise<GroveUpload> {
  if (!isGroveConfigured()) {
    throw new Error("Lens Grove uploads are disabled (LENS_GROVE_DISABLED=true).");
  }

  const chainId = options?.chainId ?? LENS_GROVE_CHAIN_ID;
  const wallet = options?.walletAddress?.trim();
  const acl =
    wallet && isAddress(wallet, { strict: false })
      ? walletOnly(getAddress(wallet), chainId)
      : immutable(chainId);

  const response = await getClient().uploadAsJson(payload, {
    acl,
    ...(options?.name ? { name: options.name } : {}),
  });

  const uri = response.uri || `lens://${response.storageKey}`;
  const url = response.gatewayUrl || resolveGroveUrl(uri);
  const serialized = JSON.stringify(payload);

  return {
    uri,
    storageKey: response.storageKey,
    cid: uri,
    url,
    size: Buffer.byteLength(serialized, "utf8"),
  };
}
