import { prisma } from "@/lib/db";
import { generateToken, sha256Hex } from "@/lib/crypto";
import { isSameOrigin } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { Role } from "@/lib/generated/prisma/client";

const RESET_TTL_MINUTES = 30;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`forgot:${ip}`, 5, 60_000).ok) {
    return Response.json({ error: "Demasiadas tentativas." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    // Same response regardless — no account enumeration.
    return Response.json({ ok: true });
  }

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.email, role: { in: [Role.ADMIN, Role.STAFF] } },
  });

  if (user) {
    const token = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: sha256Hex(token),
        passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
    });

    // Phase 7 replaces this with a branded Resend email. Until then the link
    // is printed to the server console (development only).
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    console.log(
      `[recuperar-palavra-passe] Link para ${user.email}: ${base}/redefinir-palavra-passe?token=${token}`,
    );
  }

  return Response.json({ ok: true });
}
