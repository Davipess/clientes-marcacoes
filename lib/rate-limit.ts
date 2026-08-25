type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Limite para mutations autenticadas (admin/staff): generoso, mas impede
 * scripts de martelarem endpoints mesmo com sessao valida.
 */
export function mutationLimit(
  request: Request,
  scope: string,
  limit = 30,
  windowMs = 60_000,
): Response | null {
  const ip = clientIpFrom(request);
  if (!rateLimit(`${scope}:${ip}`, limit, windowMs).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }
  return null;
}

/**
 * Client IP for rate limiting. Priority: platform-set headers first
 * (trusted), then the LAST entry of X-Forwarded-For (appended by the
 * proxy — earlier entries are client-controlled and spoofable).
 */
export function clientIpFrom(request: Request): string {
  const nf = request.headers.get("x-nf-client-connection-ip"); // Netlify
  if (nf) return nf;
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim());
    return parts[parts.length - 1] || "unknown";
  }
  return "unknown";
}

/**
 * Simple fixed-window rate limiter (in memory).
 * Sufficient for a single-instance deployment; swap for Redis when scaling out.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

// Occasional cleanup so the map does not grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 60_000).unref();
