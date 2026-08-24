import { getAuthUser, isSameOrigin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@/lib/generated/prisma/client";

export type StaffGuardResult =
  | {
      ok: true;
      staffId: string;
      businessId: string;
      userId: string;
      isAdmin: boolean;
    }
  | { ok: false; response: Response };

/** Guard for /api/staff/*: session of a STAFF member (or ADMIN in solo mode). */
export async function requireStaff(request: Request): Promise<StaffGuardResult> {
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && !isSameOrigin(request)) {
    return {
      ok: false,
      response: Response.json({ error: "Pedido inválido" }, { status: 403 }),
    };
  }

  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Sessão expirada." }, { status: 401 }),
    };
  }
  if (user.role !== Role.STAFF && user.role !== Role.ADMIN) {
    return {
      ok: false,
      response: Response.json({ error: "Não autorizado." }, { status: 403 }),
    };
  }

  const staff = await prisma.staff.findFirst({
    where: { businessId: user.businessId ?? "", userId: user.id },
    select: { id: true, businessId: true, active: true },
  });
  if (!staff || !staff.active) {
    return {
      ok: false,
      response: Response.json(
        { error: "Perfil de técnica inexistente ou inativo." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    staffId: staff.id,
    businessId: staff.businessId,
    userId: user.id,
    isAdmin: user.role === Role.ADMIN,
  };
}
