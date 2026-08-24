import { prisma } from "@/lib/db";
import { getAuthUser, isSameOrigin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { passwordSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = clientIpFrom(request);
  if (!rateLimit(`pwchange:${ip}`, 5, 60_000).ok) {
    return Response.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser.passwordHash) {
    return Response.json({ error: "Conta sem palavra-passe." }, { status: 400 });
  }

  const valid = await verifyPassword(dbUser.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    return Response.json({ error: "Palavra-passe atual incorreta." }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get("sessao")?.value;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    }),
    // Invalidate every OTHER session; the current one stays alive.
    ...(currentToken
      ? [
          prisma.session.deleteMany({
            where: { userId: user.id, token: { not: currentToken } },
          }),
        ]
      : []),
  ]);

  return Response.json({ ok: true });
}
