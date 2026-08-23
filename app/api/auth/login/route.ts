import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createSession, isSameOrigin } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { Role } from "@/lib/generated/prisma/client";

// Constant-ish work factor for unknown emails to avoid user enumeration timing.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Xj5Jd9iMuMPLVmLKvP4rOJGMtZmB+bh0SpctLjWV1+k";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  const emailKey = parsed.success ? parsed.data.email.toLowerCase() : "unknown";

  // Limit per IP and per email.
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 60_000);
  const emailLimit = rateLimit(`login:email:${emailKey}`, 5, 60_000);
  if (!ipLimit.ok || !emailLimit.ok) {
    return Response.json(
      { error: "Demasiadas tentativas. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  if (!parsed.success) {
    return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: parsed.data.email,
      role: { in: [Role.ADMIN, Role.STAFF] },
    },
  });

  let valid = false;
  if (user?.passwordHash) {
    valid = await verifyPassword(user.passwordHash, parsed.data.password);
  } else {
    await verifyPassword(DUMMY_HASH, "dummy-password-attempt");
  }

  if (!user || !valid) {
    return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  await createSession(user.id);
  return Response.json({
    ok: true,
    redirect: user.role === Role.ADMIN ? "/admin" : "/staff",
  });
}
