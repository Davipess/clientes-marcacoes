import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createSession, isSameOrigin } from "@/lib/auth";
import { setupSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { Role } from "@/lib/generated/prisma/client";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limited = rateLimit(`setup:${ip}`, 5, 60_000);
  if (!limited.ok) {
    return Response.json(
      { error: "Demasiadas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  // One-time bootstrap: only allowed while no ADMIN exists.
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });
  if (existingAdmin) {
    return Response.json({ error: "Configuração já concluída" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return Response.json(
      { error: "Nenhum negócio configurado. Execute primeiro a seed." },
      { status: 500 },
    );
  }

  const duplicate = await prisma.user.findUnique({
    where: { businessId_email: { businessId: business.id, email: parsed.data.email } },
  });
  if (duplicate) {
    return Response.json({ error: "Email já registado" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      role: Role.ADMIN,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await createSession(user.id);
  return Response.json({ ok: true });
}
