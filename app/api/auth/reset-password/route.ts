import { prisma } from "@/lib/db";
import { hashPassword, safeEqual, sha256Hex } from "@/lib/crypto";
import { isSameOrigin } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { Role } from "@/lib/generated/prisma/client";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`reset:${ip}`, 5, 60_000).ok) {
    return Response.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: { not: null },
      passwordResetExpiresAt: { gt: new Date() },
      role: { in: [Role.ADMIN, Role.STAFF] },
    },
  });

  let matched = false;
  if (user?.passwordResetTokenHash) {
    matched = safeEqual(user.passwordResetTokenHash, sha256Hex(parsed.data.token));
  }
  if (!matched || !user) {
    return Response.json(
      { error: "Link inválido ou expirado. Peça uma nova recuperação." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }),
    // Invalidate all existing sessions after a password change.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return Response.json({ ok: true });
}
