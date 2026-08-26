import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || !user.businessId) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const ua = request.headers.get("user-agent") || "";

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
