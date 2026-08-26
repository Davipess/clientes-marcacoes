import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.endpoint) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Scope deletion to the authenticated user's own subscriptions
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });

  return Response.json({ ok: true });
}
