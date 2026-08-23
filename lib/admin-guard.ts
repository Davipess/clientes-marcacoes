import { getAuthUser, isSameOrigin } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";

export type AdminGuardResult =
  | { ok: true; businessId: string; userId: string }
  | { ok: false; response: Response };

/** Guard for /api/admin/* routes: same-origin + ADMIN session. */
export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  if (!isSameOrigin(request)) {
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
  return { ok: true, businessId: user.businessId, userId: user.id };
}
