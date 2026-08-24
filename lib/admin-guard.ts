import { getAuthUser, isSameOrigin } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";

export type AdminGuardResult =
  | { ok: true; businessId: string; userId: string; email: string }
  | { ok: false; response: Response };

/** Guard for /api/admin/* routes: ADMIN session (+ same-origin for mutations). */
export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && !isSameOrigin(request)) {
    return {
      ok: false,
      response: Response.json({ error: "Pedido inválido" }, { status: 403 }),
    };
  }
  const user = await getAuthUser();
  if (!user || user.role !== Role.ADMIN || !user.businessId) {
    return {
      ok: false,
      response: Response.json({ error: "Não autorizado" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    businessId: user.businessId,
    userId: user.id,
    email: user.email,
  };
}
