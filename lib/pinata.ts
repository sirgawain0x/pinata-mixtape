import { fetchWithTimeout } from "./outbound";

const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

export type PinataUpload = {
  cid: string;
  url: string;
  size: number;
};

export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT);
}

export function gatewayUrl(cid: string): string {
  if (!cid) return "";
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.replace(/\/$/, "") || "https://gateway.pinata.cloud";
  const key = process.env.PINATA_GATEWAY_KEY;
  const base = `${gateway}/ipfs/${cid}`;
  return key ? `${base}?pinataGatewayToken=${encodeURIComponent(key)}` : base;
}

export async function uploadFile(
  buffer: Buffer | Uint8Array,
  options: { name: string; mimeType?: string }
): Promise<PinataUpload> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not configured.");
  }

  const safeName = options.name.replace(/[^A-Za-z0-9._-]/g, "_") || "upload";
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([bytes], options.mimeType ? { type: options.mimeType } : undefined);

  const form = new FormData();
  form.append("file", blob, safeName);
  form.append("network", "public");

  const response = await fetchWithTimeout(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`
    },
    body: form
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pinata upload failed (${response.status}): ${text}`);
  }

  const data = (await response.json().catch(() => null)) as
    | { data?: { cid?: string; size?: number } }
    | null;

  const cid = data?.data?.cid;
  if (!cid) {
    throw new Error("Pinata response missing CID.");
  }

  return {
    cid,
    url: gatewayUrl(cid),
    size: data?.data?.size ?? buffer.byteLength
  };
}
