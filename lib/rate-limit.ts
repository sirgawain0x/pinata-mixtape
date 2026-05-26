type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/** Simple fixed-window counter (per-process; suitable as a fast backstop before platform limits). */
export function rateLimitHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function clientLimiterKey(request: Request, fallback = "anonymous"): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return `ip:${fwd}`;
  const rip = request.headers.get("x-real-ip")?.trim();
  if (rip) return `ip:${rip}`;
  return `id:${fallback}`;
}
