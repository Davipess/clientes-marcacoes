import { prisma } from "@/lib/db";
import { getAuthUser, isSameOrigin } from "@/lib/auth";
import { piiLookupHash, normalizePhone } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit: 5 subscribe attempts per minute per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`push-subscribe:${ip}`, 5, 60_000).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const ua = request.headers.get("user-agent") || "";

  // Authenticated user (admin/staff)
  const user = await getAuthUser();
  if (user?.businessId) {
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        businessId: user.businessId,
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: ua,
      },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: ua,
      },
    });
    return Response.json({ ok: true });
  }

  // Unauthenticated client — requires same-origin + businessId + phone
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const businessId = body.businessId;
  const phone = body.phone;
  if (!businessId || !phone) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const phoneHash = piiLookupHash(normalizePhone(phone));

  await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      businessId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: ua,
      clientPhoneHash: phoneHash,
    },
    update: {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: ua,
    },
  });

  return Response.json({ ok: true });
}
