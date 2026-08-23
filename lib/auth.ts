import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateToken, sha256Hex } from "@/lib/crypto";
import type { Role } from "@/lib/generated/prisma/client";

const SESSION_COOKIE = "sessao";
const SESSION_TTL_DAYS = 30;

export type AuthUser = {
  id: string;
  businessId: string | null;
  role: Role;
  name: string;
  email: string;
};

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);

  await prisma.session.create({
    data: {
      userId,
      token: sha256Hex(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: sha256Hex(token) },
    include: {
      user: {
        select: { id: true, businessId: true, role: true, name: true, email: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .delete({ where: { token: sha256Hex(token) } })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

// CSRF defence for mutating requests: SameSite=Lax cookies already block
// cross-site POSTs in modern browsers; this adds an explicit origin check.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
