interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

let lastCleanup = Date.now();

export default async (request: Request, context: { ip?: string }) => {
  if (request.method !== "POST") return;

  const ip = context.ip;
  if (!ip) return;

  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }

  const key = `${request.url}:${ip}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }

  bucket.count++;
  if (bucket.count > 5) {
    return new Response(JSON.stringify({ error: "Demasiados pedidos. Tente novamente mais tarde." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)),
      },
    });
  }
};

export const config = {
  path: [
    "/api/loyalty",
    "/api/loyalty/*",
    "/api/waitlist",
    "/api/push/subscribe",
    "/api/marcacoes",
  ],
};
