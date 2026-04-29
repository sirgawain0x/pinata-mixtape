import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 15_000;
const LOOPBACK_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function assertPublicHttpUrl(value: string, label = "URL"): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http or https.`);
  }

  const hostname = url.hostname.toLowerCase();
  const ipVersion = isIP(hostname);
  if (
    LOOPBACK_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    (ipVersion === 4 && isPrivateIpv4(hostname)) ||
    (ipVersion === 6 && isPrivateIpv6(hostname))
  ) {
    throw new Error(`${label} cannot target local or private network hosts.`);
  }

  return url;
}

export function assertSameOriginOrRelativeUrl(value: string, base: string, label = "URL"): URL {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const baseUrl = new URL(base);
  if (url.origin !== baseUrl.origin) {
    throw new Error(`${label} must stay on the configured provider origin.`);
  }
  return url;
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
